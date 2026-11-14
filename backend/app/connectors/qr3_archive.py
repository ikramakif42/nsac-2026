"""IRSA transport, validated FITS storage, and backend-only image operations."""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import math
import os
import tempfile
import time
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.io.votable import parse
from astropy.nddata import Cutout2D
from astropy.time import Time
from astropy.wcs import WCS
from fastapi import HTTPException

from app.models.cids import ObservationRecord, WCSParameters


class ArchiveError(Exception):
    """An upstream response cannot safely be used as scientific data."""


def validate_position(ra: float, dec: float) -> None:
    if not math.isfinite(ra) or not 0 <= ra < 360:
        raise HTTPException(422, "RA must be finite and in [0, 360).")
    if not math.isfinite(dec) or not -90 <= dec <= 90:
        raise HTTPException(422, "Declination must be finite and in [-90, 90].")


def validate_url(url: str) -> str:
    parts = urlsplit(url)
    hosts = {
        item.strip().lower()
        for item in os.getenv(
            "IRSA_ALLOWED_HOSTS", "irsa.ipac.caltech.edu"
        ).split(",")
        if item.strip()
    }
    if (
        parts.scheme != "https"
        or parts.hostname not in hosts
        or parts.port not in (None, 443)
        or parts.username
        or parts.password
        or parts.fragment
    ):
        raise ArchiveError("Archive returned a disallowed product URL.")
    return url


class Transport:
    def __init__(self) -> None:
        self.timeout = httpx.Timeout(60.0, connect=10.0)
        self.max_fits_bytes = int(
            os.getenv("QR3_MAX_FITS_BYTES", str(256 * 1024 * 1024))
        )
        self.max_metadata_bytes = 16 * 1024 * 1024

    async def get(
        self,
        url: str,
        *,
        params: dict | None = None,
        fits_file: bool = False,
    ) -> bytes:
        url = validate_url(url)
        limit = self.max_fits_bytes if fits_file else self.max_metadata_bytes
        headers = {"User-Agent": "ORBIT-LENS/1.0", "Accept-Encoding": "identity"}

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    follow_redirects=False,
                    trust_env=False,
                ) as client:
                    current = url
                    current_params = params
                    for redirect_count in range(4):
                        async with client.stream(
                            "GET", current, params=current_params, headers=headers
                        ) as response:
                            if response.status_code in (301, 302, 303, 307, 308):
                                location = response.headers.get("location")
                                if not location or redirect_count == 3:
                                    raise ArchiveError("Invalid archive redirect.")
                                current = validate_url(urljoin(str(response.url), location))
                                current_params = None
                                continue

                            response.raise_for_status()
                            length = response.headers.get("content-length")
                            if length is not None and int(length) > limit:
                                raise ArchiveError("Archive response exceeds the size limit.")
                            chunks: list[bytes] = []
                            size = 0
                            async for chunk in response.aiter_bytes():
                                size += len(chunk)
                                if size > limit:
                                    raise ArchiveError(
                                        "Archive response exceeds the size limit."
                                    )
                                chunks.append(chunk)
                            return b"".join(chunks)
                    raise ArchiveError("Archive redirect limit exceeded.")
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status not in (429, 502, 503, 504) or attempt == 2:
                    raise ArchiveError(f"IRSA returned HTTP {status}.") from exc
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt == 2:
                    raise ArchiveError("IRSA could not be reached.") from exc
            except ValueError as exc:
                raise ArchiveError("Invalid archive HTTP response.") from exc
            await asyncio.sleep(0.5 * (2**attempt))
        raise ArchiveError("Archive request failed.")


def read_rows(payload: bytes) -> tuple[list[dict], bool]:
    """Parse DAL VOTables, including QUERY_STATUS error/overflow information."""
    try:
        document = parse(io.BytesIO(payload), verify="exception")
        infos = list(document.infos)
        for resource in document.resources:
            infos.extend(resource.infos)
            for table in resource.tables:
                infos.extend(table.infos)

        overflow = False
        for info in infos:
            if str(info.name).upper() == "QUERY_STATUS":
                value = str(info.value).upper()
                if value == "ERROR":
                    raise ArchiveError(
                        f"IRSA query failed: {str(info.content or 'unspecified error')[:300]}"
                    )
                overflow |= value == "OVERFLOW"

        table = document.get_first_table().to_table(use_names_over_ids=True)
        rows = []
        for row in table:
            result = {}
            for name in table.colnames:
                value = row[name]
                if np.ma.is_masked(value):
                    value = None
                elif isinstance(value, bytes):
                    value = value.decode("utf-8", errors="strict")
                elif isinstance(value, np.generic):
                    value = value.item()
                result[name.lower()] = value
            rows.append(result)
        return rows, overflow
    except ArchiveError:
        raise
    except Exception as exc:
        raise ArchiveError("IRSA did not return a valid DAL VOTable.") from exc


class FitsCache:
    """Content-addressed, atomic disk cache with TTL and byte-budget eviction."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or Path(os.getenv("QR3_CACHE_DIR", ".cache/orbit-lens/qr3"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.ttl = int(os.getenv("QR3_CACHE_TTL_SECONDS", "86400"))
        self.budget = int(os.getenv("QR3_CACHE_MAX_BYTES", str(2 * 1024**3)))

    @staticmethod
    def key(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def path(self, key: str, suffix: str = ".fits") -> Path:
        if len(key) != 64 or any(c not in "0123456789abcdef" for c in key):
            raise ValueError("Invalid cache key.")
        return self.root / f"{key}{suffix}"

    def get(self, key: str, suffix: str = ".fits") -> bytes | None:
        path = self.path(key, suffix)
        try:
            if time.time() - path.stat().st_mtime > self.ttl:
                path.unlink(missing_ok=True)
                return None
            return path.read_bytes()
        except FileNotFoundError:
            return None

    def put(self, key: str, payload: bytes, suffix: str = ".fits") -> None:
        if len(payload) > self.budget:
            raise ArchiveError("Product exceeds the configured disk-cache budget.")
        destination = self.path(key, suffix)
        name = None
        try:
            with tempfile.NamedTemporaryFile(dir=self.root, delete=False) as stream:
                name = stream.name
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, destination)
            name = None
            self.prune()
        finally:
            if name is not None:
                Path(name).unlink(missing_ok=True)

    def prune(self) -> None:
        entries = []
        for path in self.root.iterdir():
            if path.suffix not in (".fits", ".json"):
                continue
            try:
                stat = path.stat()
                if time.time() - stat.st_mtime > self.ttl:
                    path.unlink(missing_ok=True)
                else:
                    entries.append((stat.st_mtime, stat.st_size, path))
            except FileNotFoundError:
                continue
        total = sum(size for _, size, _ in entries)
        for _, size, path in sorted(entries):
            if total <= self.budget:
                break
            path.unlink(missing_ok=True)
            total -= size

    def save_manifest(self, record_id: str, manifest: dict) -> None:
        self.put(
            self.key(record_id),
            json.dumps(manifest, allow_nan=False).encode("utf-8"),
            ".json",
        )

    def load_manifest(self, record_id: str) -> dict:
        payload = self.get(self.key(record_id), ".json")
        if payload is None:
            raise HTTPException(404, "Observation expired or is unknown; repeat the search.")
        try:
            return json.loads(payload)
        except (ValueError, UnicodeError) as exc:
            raise ArchiveError("Cached observation manifest is invalid.") from exc


def read_mef(payload: bytes) -> tuple[fits.Header, fits.Header, np.ndarray, np.ndarray, np.ndarray, WCS]:
    try:
        with fits.open(
            io.BytesIO(payload),
            memmap=False,
            lazy_load_hdus=False,
            checksum=True,
        ) as hdus:
            hdus.verify("exception")
            if len(hdus) < 4:
                raise ArchiveError("Expected Level-2 MEF HDUs 1, 2 and 3.")
            for hdu in hdus:
                if "CHECKSUM" in hdu.header and hdu.verify_checksum() != 1:
                    raise ArchiveError("FITS checksum verification failed.")
                if "DATASUM" in hdu.header and hdu.verify_datasum() != 1:
                    raise ArchiveError("FITS data checksum verification failed.")

            science = np.array(hdus[1].data, dtype=np.float32, copy=True)
            variance = np.array(hdus[2].data, dtype=np.float32, copy=True)
            raw_mask = np.asarray(hdus[3].data)
            if (
                science.ndim != 2
                or not science.size
                or variance.shape != science.shape
                or raw_mask.shape != science.shape
                or raw_mask.dtype.kind not in "iu"
                or np.any(raw_mask < 0)
                or np.any(raw_mask > 65535)
            ):
                raise ArchiveError("Incompatible science, variance or uint16 mask HDUs.")
            if not np.any(np.isfinite(science)):
                raise ArchiveError("Science HDU has no finite pixels.")
            mask = raw_mask.astype(np.uint16, copy=True)
            header = hdus[1].header.copy()
            primary = hdus[0].header.copy()
            wcs = WCS(header, fobj=hdus).celestial
            if (
                not wcs.has_celestial
                or list(wcs.wcs.ctype) != ["RA---TAN", "DEC--TAN"]
                or wcs.has_distortion
            ):
                raise ArchiveError(
                    "This product's WCS cannot be represented by the CIDS TAN contract."
                )
            if not np.all(np.isfinite(wcs.pixel_scale_matrix)):
                raise ArchiveError("Non-finite FITS WCS.")
            if abs(np.linalg.det(wcs.pixel_scale_matrix)) == 0:
                raise ArchiveError("Singular FITS WCS.")
            return primary, header, science, variance, mask, wcs
    except ArchiveError:
        raise
    except Exception as exc:
        raise ArchiveError("Invalid Level-2 FITS product.") from exc


def image_summary(science: np.ndarray, variance: np.ndarray, mask: np.ndarray) -> tuple[float | None, int, bool]:
    """Median per-pixel S/N over finite, positive-variance, unflagged pixels."""
    valid = (
        np.isfinite(science)
        & np.isfinite(variance)
        & (variance > 0)
        & (mask == 0)
    )
    snr = None
    if np.any(valid):
        snr = float(np.median(
            science[valid].astype(np.float64)
            / np.sqrt(variance[valid].astype(np.float64))
        ))
    flags = int(np.bitwise_or.reduce(mask.ravel(), initial=np.uint16(0)))
    quality_ok = bool(
        flags == 0
        and np.all(np.isfinite(science))
        and np.all(np.isfinite(variance) & (variance > 0))
    )
    return snr, flags, quality_ok


def wcs_parameters(wcs: WCS, shape: tuple[int, int]) -> WCSParameters:
    matrix = wcs.pixel_scale_matrix
    return WCSParameters(
        naxis1=shape[1],
        naxis2=shape[0],
        crpix1=float(wcs.wcs.crpix[0]),
        crpix2=float(wcs.wcs.crpix[1]),
        crval1=float(wcs.wcs.crval[0]),
        crval2=float(wcs.wcs.crval[1]),
        cdelt1=float(wcs.wcs.cdelt[0]),
        cdelt2=float(wcs.wcs.cdelt[1]),
        cd1_1=float(matrix[0, 0]),
        cd1_2=float(matrix[0, 1]),
        cd2_1=float(matrix[1, 0]),
        cd2_2=float(matrix[1, 1]),
    )


def metadata(
    payload: bytes,
    *,
    record_id: str,
    array_id: str,
    wavelength_um: float,
    epoch_mjd: float,
    fits_url: str,
) -> ObservationRecord:
    _, _, science, variance, mask, wcs = read_mef(payload)
    ra, dec = wcs.pixel_to_world_values(
        (science.shape[1] - 1) / 2, (science.shape[0] - 1) / 2
    )
    if not np.isfinite([ra, dec]).all():
        raise ArchiveError("FITS center has invalid celestial coordinates.")
    snr, flags, quality_ok = image_summary(science, variance, mask)
    return ObservationRecord(
        id=record_id,
        source="qr3",
        band=array_id,
        array_id=array_id,
        wavelength_um=wavelength_um,
        epoch_mjd=epoch_mjd,
        epoch_label=Time(epoch_mjd, format="mjd", scale="utc").iso.split(" ")[0],
        ra_center=float(ra),
        dec_center=float(dec),
        wcs=wcs_parameters(wcs, science.shape),
        fits_url=fits_url,
        snr=snr,
        quality_flags=flags,
        quality_ok=quality_ok,
    )


def make_cutout(payload: bytes, ra: float, dec: float, size_deg: float) -> bytes:
    primary, header, science, variance, mask, wcs = read_mef(payload)
    position = SkyCoord(ra=ra * u.deg, dec=dec * u.deg, frame="icrs")
    try:
        cut = Cutout2D(
            science,
            position,
            size=(size_deg * u.deg, size_deg * u.deg),
            wcs=wcs,
            mode="trim",
            copy=True,
        )
    except Exception as exc:
        raise ArchiveError("Requested cutout does not overlap this observation.") from exc

    # Rebuild the geometric header so no stale CD/PC/SIP cards survive slicing.
    out_header = cut.wcs.to_header(relax=False)
    for name in (
        "BUNIT", "MJD-OBS", "MJD-BEG", "MJD-END", "DATE-OBS",
        "EXPTIME", "FILTER", "DETECTOR", "ARRAY", "WAVELEN", "WAVEUNIT",
    ):
        if name in header:
            out_header[name] = (header[name], header.comments[name])

    slices = cut.slices_original
    hdus = fits.HDUList([
        fits.PrimaryHDU(header=primary),
        fits.ImageHDU(cut.data.astype(np.float32), header=out_header, name="SCI"),
        fits.ImageHDU(variance[slices].astype(np.float32), name="VAR"),
        fits.ImageHDU(mask[slices].astype(np.uint16), name="MASK"),
    ])
    stream = io.BytesIO()
    hdus.writeto(stream, checksum=True, output_verify="exception")
    output = stream.getvalue()
    read_mef(output)
    return output