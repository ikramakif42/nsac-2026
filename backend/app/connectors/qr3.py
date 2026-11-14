"""Real QR3 discovery, product resolution, FITS caching and scientific metadata."""

from __future__ import annotations

import asyncio
import math
import os
from urllib.parse import urlencode, urljoin

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from fastapi import HTTPException

from app.connectors.base import BaseConnector
from app.connectors.qr3_archive import (
    ArchiveError,
    FitsCache,
    Transport,
    image_summary,
    make_cutout,
    metadata,
    read_mef,
    read_rows,
    validate_position,
    validate_url,
)
from app.models.cids import (
    CompareResult,
    CubeAxis,
    ObservationRecord,
    QualityReport,
    SearchQuery,
    SearchResult,
    SpectrumResponse,
    TileChunk,
    TileQuery,
    TileResponse,
    TimeCubeMetadata,
    TimeCubeSlice,
)
from app.science.lvf_model import SPHEREX_ARRAYS


def first(row: dict, *names: str):
    for name in names:
        value = row.get(name)
        if value is not None and str(value).strip():
            return value
    return None


class QR3Connector(BaseConnector):
    id = "qr3"
    label = "SPHEREx QR3 (IRSA)"

    def __init__(self):
        self._release = os.getenv("RELEASE", "qr3")
        self.transport = Transport()
        self.cache = FitsCache()
        self.sia_url = os.getenv("IRSA_SIA_URL", "https://irsa.ipac.caltech.edu/SCS")
        self.tap_url = os.getenv("IRSA_TAP_URL", "https://irsa.ipac.caltech.edu/TAP/sync")
        self.ibe_url = os.getenv(
            "IRSA_IBE_URL", "https://irsa.ipac.caltech.edu/ibe/data/spherex/enhanced"
        )
        self.discovery = os.getenv("QR3_DISCOVERY", "sia").lower()
        self.max_records = int(os.getenv("QR3_MAX_RECORDS", "128"))
        self.cutout_size_deg = float(os.getenv("QR3_CUTOUT_SIZE_DEG", str(60 / 3600)))
        if self.discovery not in ("sia", "tap"):
            raise ValueError("QR3_DISCOVERY must be sia or tap.")
        if not 1 <= self.max_records <= 10000:
            raise ValueError("QR3_MAX_RECORDS must be between 1 and 10000.")
        if not math.isfinite(self.cutout_size_deg) or not 0 < self.cutout_size_deg <= 10:
            raise ValueError("QR3_CUTOUT_SIZE_DEG must be in (0, 10].")

    async def _tap_query(self, query: SearchQuery) -> bytes:
        """ADQL TAP query as a fallback or primary discovery path."""
        radius = query.radius_arcsec / 3600
        adql = (
            f"SELECT TOP {self.max_records + 1} * FROM spherex_qr3 "
            "WHERE 1=CONTAINS("
            "POINT('ICRS',s_ra,s_dec),"
            f"CIRCLE('ICRS',{query.ra:.15g},{query.dec:.15g},{radius:.15g}))"
        )
        if query.epoch_range:
            start, end = query.epoch_range
            adql += f" AND t_max >= {start:.15g} AND t_min <= {end:.15g}"
        adql += " ORDER BY t_min"
        return await self.transport.get(
            self.tap_url,
            params={
                "REQUEST": "doQuery",
                "LANG": "ADQL",
                "FORMAT": "votable",
                "QUERY": adql,
            },
        )

    async def _discover(self, query: SearchQuery) -> tuple[list[dict], bool]:
        radius = query.radius_arcsec / 3600
        if self.discovery == "tap":
            payload = await self._tap_query(query)
            return await asyncio.to_thread(read_rows, payload)

        # SIA primary path with automatic TAP fallback on network failure
        params = {"POS": f"CIRCLE {query.ra:.15g} {query.dec:.15g} {radius:.15g}"}
        if query.epoch_range:
            params["TIME"] = " ".join(format(v, ".15g") for v in query.epoch_range)
        try:
            payload = await self.transport.get(self.sia_url, params=params)
            return await asyncio.to_thread(read_rows, payload)
        except ArchiveError:
            # SIA endpoint unreachable (e.g. network-blocked) — fall back to TAP
            payload = await self._tap_query(query)
            return await asyncio.to_thread(read_rows, payload)

    def _descriptor(self, row: dict) -> dict:
        array = first(row, "array_id", "array", "detector", "band")
        if array is not None:
            text = str(array).strip()
            if text in ("1", "2", "3", "4", "5", "6"):
                text = f"Array{text}"
            array = next(
                (name for name in SPHEREX_ARRAYS if name.lower() == text.lower()),
                None,
            )
        if array is None:
            raise ArchiveError("Archive row lacks an explicit supported detector-array ID.")

        wavelength = first(row, "wavelength_um")
        if wavelength is None:
            lo, hi = first(row, "em_min"), first(row, "em_max")
            if lo is None or hi is None:
                raise ArchiveError("Archive row lacks wavelength metadata.")
            wavelength = (float(lo) + float(hi)) * 0.5e6
        wavelength = float(wavelength)
        limits = SPHEREX_ARRAYS[array]
        if not math.isfinite(wavelength) or not limits["wl_min"] <= wavelength <= limits["wl_max"]:
            raise ArchiveError("Archive wavelength disagrees with its detector array.")

        epoch = first(row, "epoch_mjd", "mjd_obs", "mjd-obs")
        if epoch is None:
            start, end = first(row, "t_min"), first(row, "t_max")
            if start is None or end is None:
                raise ArchiveError("Archive row lacks an observation epoch.")
            epoch = (float(start) + float(end)) / 2
        epoch = float(epoch)
        if not math.isfinite(epoch):
            raise ArchiveError("Archive row contains a non-finite epoch.")

        url = first(row, "access_url", "fits_url", "download_url")
        if url is None:
            path = first(row, "file_path", "filepath")
            if path is None:
                raise ArchiveError("Archive row lacks an individual FITS product URL.")
            url = urljoin(self.ibe_url.rstrip("/") + "/", str(path))
        url = validate_url(str(url))
        access_format = str(first(row, "access_format") or "").lower()
        if access_format and "fits" not in access_format:
            raise ArchiveError("Archive row is not a direct FITS product.")

        product_id = first(row, "obs_publisher_did", "obs_id", "id") or url
        identity = f"qr3|{array}|{epoch:.12f}|{product_id}"
        record_id = f"qr3_{array}_{epoch:.8f}_{self.cache.key(identity)[:20]}"
        return {
            "record_id": record_id,
            "array_id": array,
            "wavelength_um": wavelength,
            "epoch_mjd": epoch,
            "product_url": url,
            "size_deg": self.cutout_size_deg,
        }

    async def _product(self, url: str) -> bytes:
        key = self.cache.key(url)
        payload = await asyncio.to_thread(self.cache.get, key)
        if payload is not None:
            try:
                await asyncio.to_thread(read_mef, payload)
                return payload
            except ArchiveError:
                await asyncio.to_thread(self.cache.path(key).unlink, missing_ok=True)
        payload = await self.transport.get(url, fits_file=True)
        await asyncio.to_thread(read_mef, payload)
        await asyncio.to_thread(self.cache.put, key, payload)
        return payload

    async def _record(self, descriptor: dict) -> ObservationRecord:
        payload = await self._product(descriptor["product_url"])
        record = await asyncio.to_thread(
            metadata,
            payload,
            record_id=descriptor["record_id"],
            array_id=descriptor["array_id"],
            wavelength_um=descriptor["wavelength_um"],
            epoch_mjd=descriptor["epoch_mjd"],
            fits_url=descriptor["product_url"],
        )
        await asyncio.to_thread(
            self.cache.save_manifest, record.id, descriptor
        )
        return record

    async def search(self, query: SearchQuery) -> SearchResult:
        validate_position(query.ra, query.dec)
        if query.source not in (None, "qr3"):
            raise HTTPException(422, "QR3 connector only accepts source='qr3'.")
        if query.epoch_range:
            start, end = query.epoch_range
            if not math.isfinite(start) or not math.isfinite(end) or start > end:
                raise HTTPException(422, "Epoch range must be finite and ordered.")
        if query.bands and any(band not in SPHEREX_ARRAYS for band in query.bands):
            raise HTTPException(422, "QR3 band filters must use Array1 through Array6.")

        try:
            rows, overflow = await self._discover(query)
            descriptors = {}
            rejected = 0
            for row in rows:
                try:
                    descriptor = self._descriptor(row)
                except (ArchiveError, ValueError, TypeError, OverflowError):
                    rejected += 1
                    continue
                if query.bands and descriptor["array_id"] not in query.bands:
                    continue
                if query.epoch_range:
                    if not query.epoch_range[0] <= descriptor["epoch_mjd"] <= query.epoch_range[1]:
                        continue
                descriptors[descriptor["record_id"]] = descriptor

            ordered = sorted(
                descriptors.values(),
                key=lambda item: (item["epoch_mjd"], item["array_id"], item["record_id"]),
            )
            truncated = overflow or len(ordered) > self.max_records
            records = []
            product_errors = []
            # Sequential hydration bounds FITS decode memory and upstream load.
            for descriptor in ordered[:self.max_records]:
                try:
                    records.append(await self._record(descriptor))
                except ArchiveError as exc:
                    product_errors.append(str(exc))
            if not records and (rejected or product_errors):
                reason = product_errors[0] if product_errors else (
                    "Rows lack supported detector, epoch, wavelength or product metadata."
                )
                raise ArchiveError(f"No returned archive products were usable. {reason}")

            warnings = []
            if rejected:
                warnings.append(f"{rejected} unsupported archive rows were excluded.")
            if product_errors:
                warnings.append(f"{len(product_errors)} invalid or unavailable products were excluded.")
            if truncated:
                warnings.append(
                    "Archive results were truncated; narrow the position or epoch range. "
                    "total counts returned records, not all archive matches."
                )
            return SearchResult(
                query=query,
                records=records,
                total=len(records),
                source_used="qr3",
                warning=" ".join(warnings) or None,
            )
        except ArchiveError as exc:
            raise HTTPException(502, f"SPHEREx QR3 archive error: {exc}") from exc

    async def _manifest(self, record_id: str) -> dict:
        return await asyncio.to_thread(self.cache.load_manifest, record_id)

    async def _cutout_bytes(self, descriptor: dict, ra: float, dec: float) -> bytes:
        product_url = descriptor["product_url"]
        size = descriptor["size_deg"]
        key = self.cache.key(f"cutout-v1|{product_url}|{ra:.15g}|{dec:.15g}|{size:.15g}")
        cached = await asyncio.to_thread(self.cache.get, key)
        if cached is not None:
            try:
                await asyncio.to_thread(read_mef, cached)
                return cached
            except ArchiveError:
                await asyncio.to_thread(self.cache.path(key).unlink, missing_ok=True)

        # IBE parameters are applied to the individual product, never the collection.
        if "/ibe/data/" in product_url and "?" not in product_url:
            payload = await self.transport.get(
                product_url,
                params={"POS": f"{ra:.15g},{dec:.15g}", "SIZE": f"{size:.15g}", "CTYPE": "TAN"},
                fits_file=True,
            )
            await asyncio.to_thread(read_mef, payload)
        else:
            payload = await self._product(product_url)

        # Enforce the requested region even if upstream ignores its cutout parameters.
        result = await asyncio.to_thread(make_cutout, payload, ra, dec, size)
        await asyncio.to_thread(self.cache.put, key, result)
        return result

    async def fetch_fits(self, record_id: str, ra: float, dec: float, band: str) -> bytes:
        validate_position(ra, dec)
        try:
            descriptor = await self._manifest(record_id)
            if descriptor["array_id"] != band:
                raise HTTPException(422, "Band does not match the selected observation.")
            return await self._cutout_bytes(descriptor, ra, dec)
        except ArchiveError as exc:
            raise HTTPException(502, f"SPHEREx QR3 FITS error: {exc}") from exc

    async def fetch_cutout(
        self, record_id: str, ra: float, dec: float, band: str
    ) -> ObservationRecord:
        payload = await self.fetch_fits(record_id, ra, dec, band)
        descriptor = await self._manifest(record_id)
        local_url = "/cutout/fits?" + urlencode({
            "record_id": record_id, "ra": ra, "dec": dec, "band": band, "source": "qr3",
        })
        try:
            return await asyncio.to_thread(
                metadata,
                payload,
                record_id=record_id,
                array_id=descriptor["array_id"],
                wavelength_um=descriptor["wavelength_um"],
                epoch_mjd=descriptor["epoch_mjd"],
                fits_url=local_url,
            )
        except ArchiveError as exc:
            raise HTTPException(502, str(exc)) from exc

    async def _image(self, record_id: str):
        try:
            descriptor = await self._manifest(record_id)
            payload = await self._product(descriptor["product_url"])
            return descriptor, await asyncio.to_thread(read_mef, payload)
        except ArchiveError as exc:
            raise HTTPException(502, str(exc)) from exc

    async def fetch_quality(self, record_id: str) -> QualityReport:
        _, (_, _, science, variance, mask, _) = await self._image(record_id)
        snr, flags, quality_ok = image_summary(science, variance, mask)
        if snr is None:
            raise HTTPException(422, "No unflagged positive-variance pixels support an S/N estimate.")
        return QualityReport(
            status="pass" if quality_ok else "warn",
            flags_decoded=[
                f"MASK_BIT_{bit}" for bit in range(16) if flags & (1 << bit)
            ],
            snr=snr,
            notes=(
                "Median per-pixel science/sqrt(variance), excluding flagged or invalid pixels. "
                "Bit positions are reported without assigning undocumented release-specific meanings."
            ),
        )

    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse:
        # A Level-2 image is not a calibrated extracted source spectrum.
        await self._manifest(record_id)
        return SpectrumResponse(
            wavelengths=[], flux=[], variance=[], array_contributions={}
        )

    async def compare(self, record_ids: list[str]) -> CompareResult:
        if len(record_ids) < 2:
            raise HTTPException(422, "At least two observations are required.")
        descriptors = [await self._manifest(record_id) for record_id in record_ids]
        arrays = {item["array_id"] for item in descriptors}
        wavelengths = {item["wavelength_um"] for item in descriptors}
        if len(arrays) > 1 or len(wavelengths) > 1:
            return CompareResult(
                status="mismatch",
                reasons=["Observations do not share an identical detector and wavelength."],
            )
        return CompareResult(
            status="insufficient",
            reasons=[
                "Archive metadata alone does not establish a source match; "
                "registered source measurements and uncertainties are required."
            ],
        )

    async def fetch_tiles(self, query: TileQuery) -> TileResponse:
        validate_position(query.ra, query.dec)
        if not math.isfinite(query.fov_deg) or not 0 < query.fov_deg <= 5:
            raise HTTPException(422, "Tile FOV must be in (0, 5] degrees.")
        if query.source not in (None, "qr3"):
            raise HTTPException(422, "QR3 tiles require source='qr3'.")

        center = SkyCoord(query.ra * u.deg, query.dec * u.deg, frame="icrs")
        radius = query.fov_deg / 2
        boundary = center.directional_offset_by(
            np.linspace(0, 360, 361) * u.deg, radius * u.deg
        )
        ra_values = boundary.ra.wrap_at((query.ra + 180) * u.deg).deg
        dec_values = boundary.dec.deg
        search = await self.search(SearchQuery(
            ra=query.ra,
            dec=query.dec,
            radius_arcsec=max(1, radius * 3600),
            source="qr3",
        ))
        if search.warning:
            raise HTTPException(502, f"Cannot produce a complete tile count: {search.warning}")
        contains_pole = abs(query.dec) + radius >= 90
        tile = TileChunk(
            tile_id="qr3_" + self.cache.key(
                f"{query.ra:.10f}|{query.dec:.10f}|{query.fov_deg:.10f}"
            )[:24],
            ra_min=0 if contains_pole else float(np.min(ra_values) % 360),
            ra_max=360 if contains_pole else float(np.max(ra_values) % 360),
            dec_min=max(-90, query.dec - radius),
            dec_max=min(90, query.dec + radius),
            center_ra=query.ra,
            center_dec=query.dec,
            fov_deg=query.fov_deg,
            record_count=search.total,
            is_prefetched=False,
            neighbor_ids=[],
        )
        return TileResponse(active_tile=tile, prefetch_tiles=[], source_used="qr3")

    async def fetch_cube(self, record_id: str, axis: CubeAxis) -> TimeCubeMetadata:
        if axis not in ("time", "wavelength"):
            raise HTTPException(422, "Cube axis must be time or wavelength.")
        descriptor, (_, _, science, _, _, wcs) = await self._image(record_id)
        height, width = science.shape
        # Sample the actual image perimeter, not just two diagonal corners.
        x = np.concatenate([
            np.arange(width), np.arange(width),
            np.zeros(height), np.full(height, width - 1),
        ])
        y = np.concatenate([
            np.zeros(width), np.full(width, height - 1),
            np.arange(height), np.arange(height),
        ])
        coords = wcs.pixel_to_world(x, y)
        center_ra = float(wcs.wcs.crval[0])
        ras = coords.ra.wrap_at((center_ra + 180) * u.deg).deg
        decs = coords.dec.deg
        if not np.isfinite(ras).all() or not np.isfinite(decs).all():
            raise HTTPException(422, "Image perimeter cannot be represented in celestial coordinates.")
        z = descriptor["epoch_mjd"] if axis == "time" else descriptor["wavelength_um"]
        finite = science[np.isfinite(science)]
        return TimeCubeMetadata(
            record_id=record_id,
            axis=axis,
            dimensions=(width, height, 1),
            ra_range=(float(np.min(ras)), float(np.max(ras))),
            dec_range=(float(np.min(decs)), float(np.max(decs))),
            z_values=[z],
            slices=[TimeCubeSlice(
                slice_index=0,
                label=str(z),
                z_value=z,
                min_flux=float(np.min(finite)),
                max_flux=float(np.max(finite)),
            )],
            source="qr3",
        )