"""
Synthetic connector — deterministic test data for 6 SPHEREx detector arrays,
progressive 5-degree FOV tiling, and 3D time-cubes.
NEVER used as a silent fallback for real archive queries.
"""
import math
from datetime import datetime, timedelta
from typing import List
from app.connectors.base import BaseConnector
from app.models.cids import (
    SearchQuery, SearchResult, ObservationRecord, WCSParameters,
    SpectrumResponse, QualityReport, CompareResult, QualityStatus, CompareStatus,
    TileQuery, TileResponse, TileChunk, TimeCubeMetadata, TimeCubeSlice, CubeAxis,
)
from app.science.lvf_model import SPHEREX_ARRAYS, all_bands_wavelength_axis


class SyntheticConnector(BaseConnector):
    id = "synthetic"
    label = "Synthetic (Demo)"

    async def search(self, query: SearchQuery) -> SearchResult:
        """
        Generate synthetic multi-epoch observations across all 6 SPHEREx detector arrays.
        """
        records: List[ObservationRecord] = []
        base_mjd = 60300.0  # Spring 2024
        
        # 4 distinct survey epochs
        for epoch_i in range(4):
            mjd = base_mjd + epoch_i * 90.0  # ~every 3 months
            dt = datetime(2024, 3, 1) + timedelta(days=epoch_i * 90)
            epoch_str = dt.strftime("%Y-%m-%d")

            # All 6 detector arrays
            for array_id, specs in SPHEREX_ARRAYS.items():
                mid_wl = (specs["wl_min"] + specs["wl_max"]) / 2.0
                rec_id = f"syn_{array_id}_ep{epoch_i}"
                records.append(ObservationRecord(
                    id=rec_id,
                    source="synthetic",
                    band=array_id,
                    array_id=array_id,  # type: ignore
                    wavelength_um=round(mid_wl, 3),
                    epoch_mjd=mjd,
                    epoch_label=epoch_str,
                    ra_center=query.ra,
                    dec_center=query.dec,
                    wcs=WCSParameters(
                        naxis1=256, naxis2=256,
                        crpix1=128.0, crpix2=128.0,
                        crval1=query.ra, crval2=query.dec,
                        cdelt1=-2.77e-4, cdelt2=2.77e-4,
                    ),
                    fits_url=f"/synthetic/fits/{rec_id}.fits",
                    snr=round(12.5 + epoch_i * 3.2 + (hash(array_id) % 7), 1),
                    quality_flags=0,
                    quality_ok=True,
                ))

        return SearchResult(
            query=query,
            records=records,
            total=len(records),
            source_used="synthetic",
            warning="⚠ SYNTHETIC DATA — not from IRSA archive. Simulating all 6 detector arrays.",
        )

    async def fetch_cutout(self, record_id: str, ra: float, dec: float, band: str) -> ObservationRecord:
        arr_specs = SPHEREX_ARRAYS.get(band, SPHEREX_ARRAYS["Array1"])
        mid_wl = (arr_specs["wl_min"] + arr_specs["wl_max"]) / 2.0
        return ObservationRecord(
            id=record_id,
            source="synthetic",
            band=band,
            array_id=band if band in SPHEREX_ARRAYS else "Array1",  # type: ignore
            wavelength_um=round(mid_wl, 3),
            epoch_mjd=60300.0,
            epoch_label="2024-03-01",
            ra_center=ra,
            dec_center=dec,
            wcs=WCSParameters(
                naxis1=256, naxis2=256,
                crpix1=128.0, crpix2=128.0,
                crval1=ra, crval2=dec,
                cdelt1=-2.77e-4, cdelt2=2.77e-4,
            ),
            fits_url="",
            snr=22.0,
            quality_flags=0,
            quality_ok=True,
        )

    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse:
        """Return full 102-band calibrated SED across all 6 detector arrays."""
        wls = all_bands_wavelength_axis()
        # Simulated stellar / dust continuum with a 3.1μm H2O ice absorption feature in Array 4/5
        flux: List[float] = []
        for wl in wls:
            # Modified blackbody curve
            bb = (1.0 / (wl ** 4)) * math.exp(-1.44 / wl) * 1e-15
            # Ice feature dip around 3.05 - 3.15 μm
            if 2.9 <= wl <= 3.3:
                bb *= (0.4 + 0.6 * abs(wl - 3.1) / 0.2)
            flux.append(max(1e-19, bb))
        variance = [f * 0.05 ** 2 for f in flux]
        
        # Contribution mapping: which band owns which channel indices
        contributions = {
            f"Array{i+1}": list(range(i * 17, (i + 1) * 17)) for i in range(6)
        }

        return SpectrumResponse(
            wavelengths=[round(w, 4) for w in wls],
            flux=flux,
            variance=variance,
            array_contributions=contributions,
        )

    async def fetch_quality(self, record_id: str) -> QualityReport:
        return QualityReport(
            status=QualityStatus.PASS,
            flags_decoded=[],
            snr=22.0,
            notes="Synthetic — 6-array pipeline verified",
        )

    async def compare(self, record_ids: List[str]) -> CompareResult:
        return CompareResult(
            status=CompareStatus.INSUFFICIENT,
            reasons=["Synthetic connector does not compute physical astrophysical differences"],
        )

    async def fetch_tiles(self, query: TileQuery) -> TileResponse:
        """
        Compute the active 5-degree FOV chunk and directionally prefetch adjacent neighbor chunks.
        """
        fov = query.fov_deg
        # Snap to nearest 5 degree grid cell
        tile_ra_idx = int(math.floor(query.ra / fov))
        tile_dec_idx = int(math.floor(query.dec / fov))
        tile_id = f"tile_{tile_ra_idx}_{tile_dec_idx}"

        active = TileChunk(
            tile_id=tile_id,
            ra_min=tile_ra_idx * fov,
            ra_max=(tile_ra_idx + 1) * fov,
            dec_min=tile_dec_idx * fov,
            dec_max=(tile_dec_idx + 1) * fov,
            center_ra=(tile_ra_idx + 0.5) * fov,
            center_dec=(tile_dec_idx + 0.5) * fov,
            fov_deg=fov,
            record_count=24,
            is_prefetched=False,
            neighbor_ids=[],
        )

        # Directional prefetch: bias towards pan velocity vector
        step_ra = 1 if query.velocity_dra >= 0 else -1
        step_dec = 1 if query.velocity_ddec >= 0 else -1

        prefetch_list: List[TileChunk] = []
        for dra, ddec in [(step_ra, 0), (0, step_dec), (step_ra, step_dec), (-step_ra, 0)]:
            n_ra_idx = tile_ra_idx + dra
            n_dec_idx = tile_dec_idx + ddec
            nid = f"tile_{n_ra_idx}_{n_dec_idx}"
            prefetch_list.append(TileChunk(
                tile_id=nid,
                ra_min=n_ra_idx * fov,
                ra_max=(n_ra_idx + 1) * fov,
                dec_min=n_dec_idx * fov,
                dec_max=(n_dec_idx + 1) * fov,
                center_ra=(n_ra_idx + 0.5) * fov,
                center_dec=(n_dec_idx + 0.5) * fov,
                fov_deg=fov,
                record_count=24,
                is_prefetched=True,
                neighbor_ids=[],
            ))
            active.neighbor_ids.append(nid)

        return TileResponse(
            active_tile=active,
            prefetch_tiles=prefetch_list,
            source_used="synthetic",
        )

    async def fetch_cube(self, record_id: str, axis: CubeAxis) -> TimeCubeMetadata:
        """
        Generate 3D volumetric datacube metadata for Time or Wavelength dimensions.
        """
        if axis == "time":
            # 6 temporal slices
            z_vals = [60300.0 + i * 60.0 for i in range(6)]
            slices = [
                TimeCubeSlice(
                    slice_index=i,
                    label=f"Epoch {i+1} (MJD {z_vals[i]:.0f})",
                    z_value=z_vals[i],
                    min_flux=1e-18,
                    max_flux=5e-16,
                )
                for i in range(6)
            ]
        else:
            # Spectral mode: 102 channels sampled
            wls = all_bands_wavelength_axis()
            z_vals = [round(w, 3) for w in wls]
            slices = [
                TimeCubeSlice(
                    slice_index=i,
                    label=f"{z_vals[i]} μm",
                    z_value=z_vals[i],
                    min_flux=1e-19,
                    max_flux=1e-15,
                )
                for i in range(len(z_vals))
            ]

        return TimeCubeMetadata(
            record_id=record_id,
            axis=axis,
            dimensions=(256, 256, len(z_vals)),
            ra_range=(269.4521 - 0.05, 269.4521 + 0.05),
            dec_range=(4.6934 - 0.05, 4.6934 + 0.05),
            z_values=z_vals,
            slices=slices,
            source="synthetic",
        )
