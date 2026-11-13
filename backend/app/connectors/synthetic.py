"""
Synthetic connector — deterministic test data.
NEVER used as silent fallback. User must explicitly request source='synthetic'.
"""
import math
from datetime import datetime, timedelta
from app.connectors.base import BaseConnector
from app.models.cids import (
    SearchQuery, SearchResult, ObservationRecord, WCSParameters,
    SpectrumResponse, QualityReport, CompareResult, QualityStatus, CompareStatus,
)

# SPHEREx LVF band definitions (simplified; real values from calibration)
SPHEREX_BANDS = [
    ("SW1", 0.75, 1.10), ("SW2", 1.10, 1.70),
    ("LW1", 1.70, 2.70), ("LW2", 2.70, 5.00),
]


class SyntheticConnector(BaseConnector):
    id = "synthetic"
    label = "Synthetic (Demo)"

    async def search(self, query: SearchQuery) -> SearchResult:
        records = []
        base_mjd = 60300.0
        for epoch_i in range(6):
            mjd = base_mjd + epoch_i * 29.0
            dt = datetime(2024, 1, 15) + timedelta(days=epoch_i * 29)
            for band_name, wl_min, wl_max in SPHEREX_BANDS:
                wl = (wl_min + wl_max) / 2
                records.append(ObservationRecord(
                    id=f"syn_{band_name}_{epoch_i}",
                    source="synthetic",
                    band=band_name,
                    wavelength_um=wl,
                    epoch_mjd=mjd,
                    epoch_label=dt.strftime("%Y-%m-%d"),
                    ra_center=query.ra,
                    dec_center=query.dec,
                    wcs=WCSParameters(
                        naxis1=256, naxis2=256,
                        crpix1=128.0, crpix2=128.0,
                        crval1=query.ra, crval2=query.dec,
                        cdelt1=-2.77e-4, cdelt2=2.77e-4,
                    ),
                    fits_url="",
                    snr=float(10 + epoch_i + hash(band_name) % 5),
                    quality_flags=0,
                    quality_ok=True,
                ))
        return SearchResult(
            query=query,
            records=records,
            total=len(records),
            source_used="synthetic",
            warning="⚠ SYNTHETIC DATA — not from IRSA. For demonstration only.",
        )

    async def fetch_cutout(self, record_id, ra, dec, band):
        raise NotImplementedError("Synthetic cutout fetch not implemented")

    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse:
        n = 102
        wls = [0.75 + i * (5.0 - 0.75) / n for i in range(n)]
        flux = [abs(math.sin(i * 0.3)) * 1e-17 for i in range(n)]
        variance = [1e-35 for _ in range(n)]
        return SpectrumResponse(wavelengths=wls, flux=flux, variance=variance)

    async def fetch_quality(self, record_id: str) -> QualityReport:
        return QualityReport(
            status=QualityStatus.PASS,
            flags_decoded=[],
            snr=15.0,
            notes="Synthetic — no real quality assessment",
        )

    async def compare(self, record_ids: list[str]) -> CompareResult:
        return CompareResult(
            status=CompareStatus.INSUFFICIENT,
            reasons=["Synthetic data cannot be used for real variability comparison"],
        )

