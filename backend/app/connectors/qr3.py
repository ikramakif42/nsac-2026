"""
QR3 Connector — IRSA SIA v2 / IBE / TAP
Phase 1 implementation: stubs raise NotImplementedError / HTTPException.
Real implementation fills in Phase 1 of the build plan.
"""
import os
from fastapi import HTTPException
from app.connectors.base import BaseConnector
from app.models.cids import (
    SearchQuery, SearchResult, ObservationRecord,
    SpectrumResponse, QualityReport, CompareResult,
    TileQuery, TileResponse, TimeCubeMetadata, CubeAxis,
)


class QR3Connector(BaseConnector):
    id = "qr3"
    label = "SPHEREx QR3 (IRSA)"

    def __init__(self):
        self._api_key = os.getenv("IRSA_API_KEY", "")
        self._release = os.getenv("RELEASE", "qr3")

    async def search(self, query: SearchQuery) -> SearchResult:
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
        raise HTTPException(status_code=503, detail="fetch_cutout: Phase 1 not yet implemented")

    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse:
        raise HTTPException(status_code=503, detail="fetch_spectrum: Phase 5 not yet implemented")

    async def fetch_quality(self, record_id: str) -> QualityReport:
        raise HTTPException(status_code=503, detail="fetch_quality: Phase 4 not yet implemented")

    async def compare(self, record_ids: list[str]) -> CompareResult:
        raise HTTPException(status_code=503, detail="compare: Phase 7 not yet implemented")

    async def fetch_tiles(self, query: TileQuery) -> TileResponse:
        raise HTTPException(status_code=503, detail="fetch_tiles: IRSA MOC/HiPS Phase 1 not yet implemented")

    async def fetch_cube(self, record_id: str, axis: CubeAxis) -> TimeCubeMetadata:
        raise HTTPException(status_code=503, detail="fetch_cube: Phase 6 not yet implemented")
