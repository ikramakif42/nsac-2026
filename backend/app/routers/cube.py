from fastapi import APIRouter, Query, HTTPException
from app.models.cids import TimeCubeMetadata, CubeAxis
from app.connectors import get_connector

router = APIRouter()


@router.get("/cube", response_model=TimeCubeMetadata)
async def get_cube(
    record_id: str = Query(...),
    axis: CubeAxis = Query(default="time"),
    source: str = Query(default="synthetic"),
) -> TimeCubeMetadata:
    """
    Retrieve 3D volumetric Time-Cube / Spectral-Cube slicing metadata.
    """
    connector = get_connector(source)
    if connector is None:
        raise HTTPException(status_code=503, detail=f"Connector '{source}' not available")
    return await connector.fetch_cube(record_id, axis)
