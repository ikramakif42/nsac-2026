"""
QR3 Connector — IRSA SIA v2 / IBE
Phase 1 implementation: stubs raise NotImplementedError.
Real implementation fills in Phase 1 of the build plan.
"""
import os
import httpx
from fastapi import HTTPException
from app.connectors.base import BaseConnector
from app.models.cids import (
    SearchQuery, SearchResult, ObservationRecord, WCSParameters,
    SpectrumResponse, QualityReport, CompareResult, QualityStatus, CompareStatus,
)

IRSA_SIA_BASE = "https://irsa.ipac.caltech.edu/SCS"
IRSA_IBE_BASE = "https://irsa.ipac.caltech.edu/ibe/data/spitzer/enhanced"


class QR3Connector(BaseConnector):
    id = "qr3"
    label = "SPHEREx QR3 (IRSA)"

    def __init__(self):
        self._api_key = os.getenv("IRSA_API_KEY", "")
        self._release = os.getenv("RELEASE", "qr3")

    async def search(self, query: SearchQuery) -> SearchResult:
        """
        Phase 1: Query IRSA SIA v2 for SPHEREx observations.
        TODO: Implement real SIA v2 cone search.
        """
        raise HTTPException(
            status_code=503,
            detail=(
                "IRSA QR3 connector not yet implemented (Phase 1). "
                "Use source='synthetic' for demo data."
            ),
        )

    async def fetch_cutout(
        self, record_id: str, ra: float, dec: float, band: str
    ) -> ObservationRecord:
        """Phase 1: Fetch FITS cutout via IRSA IBE API."""
        raise HTTPException(status_code=503, detail="fetch_cutout: Phase 1 not yet implemented")

    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse:
        """Phase 5: 102-band SED from LVF pixel mapping."""
        raise HTTPException(status_code=503, detail="fetch_spectrum: Phase 5 not yet implemented")

    async def fetch_quality(self, record_id: str) -> QualityReport:
        """Phase 4: Quality gate from HDU 3 bitmask."""
        raise HTTPException(status_code=503, detail="fetch_quality: Phase 4 not yet implemented")

    async def compare(self, record_ids: list[str]) -> CompareResult:
        """Phase 7: Multi-epoch comparison."""
        raise HTTPException(status_code=503, detail="compare: Phase 7 not yet implemented")

