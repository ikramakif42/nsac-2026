from fastapi import APIRouter, Query, HTTPException
from app.models.cids import ObservationRecord
from app.connectors import get_connector

router = APIRouter()


@router.get("/cutout", response_model=ObservationRecord)
async def cutout(
    record_id: str = Query(...),
    ra: float = Query(...),
    dec: float = Query(...),
    band: str = Query(...),
) -> ObservationRecord:
    """
    Fetch a FITS cutout and return an ObservationRecord with HDU data.
    Uses IRSA IBE API. Level 2 MEF: HDU1=science, HDU2=variance, HDU3=mask.
    """
    connector = get_connector("qr3")
    if connector is None:
        raise HTTPException(status_code=503, detail="QR3 connector not available")
    return await connector.fetch_cutout(record_id, ra, dec, band)

