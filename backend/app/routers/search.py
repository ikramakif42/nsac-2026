from fastapi import APIRouter, HTTPException
from app.models.cids import SearchQuery, SearchResult
from app.connectors import get_connector

router = APIRouter()


@router.post("/search", response_model=SearchResult)
async def search(query: SearchQuery) -> SearchResult:
    """
    Search for SPHEREx observations at given sky coordinates.
    Returns all matching ObservationRecords from the IRSA archive.
    NEVER silently falls back to synthetic data on archive failure.
    """
    source_id = query.source or "qr3"
    connector = get_connector(source_id)
    if connector is None:
        raise HTTPException(status_code=503, detail=f"Connector '{source_id}' not available")
    return await connector.search(query)

