from fastapi import APIRouter, HTTPException

from app.connectors import get_connector
from app.models.cids import TileQuery, TileResponse
from app.routers.cds import router as cds_router

router = APIRouter()
router.include_router(cds_router)


@router.post("/tiles", response_model=TileResponse)
async def get_tiles(query: TileQuery) -> TileResponse:
    """Progressive FOV indexing and directional chunk prefetching."""
    source_id = query.source or "synthetic"
    connector = get_connector(source_id)
    if connector is None:
        raise HTTPException(
            status_code=503,
            detail=f"Connector '{source_id}' not available",
        )
    return await connector.fetch_tiles(query)