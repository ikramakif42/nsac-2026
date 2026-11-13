from fastapi import APIRouter, HTTPException
from app.models.cids import TileQuery, TileResponse
from app.connectors import get_connector

router = APIRouter()


@router.post("/tiles", response_model=TileResponse)
async def get_tiles(query: TileQuery) -> TileResponse:
    """
    Progressive 5-degree FOV tile index and predictive directional chunk prefetching.
    """
    source_id = query.source or "synthetic"
    connector = get_connector(source_id)
    if connector is None:
        raise HTTPException(status_code=503, detail=f"Connector '{source_id}' not available")
    return await connector.fetch_tiles(query)
