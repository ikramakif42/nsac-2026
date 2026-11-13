from fastapi import APIRouter, HTTPException
from app.models.cids import CompareRequest, CompareResult
from app.connectors import get_connector

router = APIRouter()


@router.post("/compare", response_model=CompareResult)
async def compare(body: CompareRequest) -> CompareResult:
    """
    Compare multiple ObservationRecords for variability analysis.
    Gate: requires at least 2 quality-pass records.
    """
    connector = get_connector("qr3")
    if connector is None:
        raise HTTPException(status_code=503, detail="QR3 connector not available")
    return await connector.compare(body.record_ids)

