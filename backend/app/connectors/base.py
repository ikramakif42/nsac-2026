"""Abstract base connector interface."""
from abc import ABC, abstractmethod
from app.models.cids import (
    SearchQuery, SearchResult, ObservationRecord,
    SpectrumResponse, QualityReport, CompareResult,
)


class BaseConnector(ABC):
    id: str
    label: str

    @abstractmethod
    async def search(self, query: SearchQuery) -> SearchResult: ...

    @abstractmethod
    async def fetch_cutout(
        self, record_id: str, ra: float, dec: float, band: str
    ) -> ObservationRecord: ...

    @abstractmethod
    async def fetch_spectrum(self, record_id: str) -> SpectrumResponse: ...

    @abstractmethod
    async def fetch_quality(self, record_id: str) -> QualityReport: ...

    @abstractmethod
    async def compare(self, record_ids: list[str]) -> CompareResult: ...

