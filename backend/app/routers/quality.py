from fastapi import APIRouter, Query, HTTPException
from app.models.cids import QualityReport
from app.connectors import get_connector

router = APIRouter()


@router.get("/quality", response_model=QualityReport)
async def quality(record_id: str = Query(...)) -> QualityReport:
    """
    Assess observation quality using HDU 3 bitmask and HDU 2 variance.
    Returns decoded flag labels and SNR estimate.
    """
    connector = get_connector("qr3")
    if connector is None:
        raise HTTPException(status_code=503, detail="QR3 connector not available")
    return await connector.fetch_quality(record_id)

