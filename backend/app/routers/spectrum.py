from fastapi import APIRouter, Query, HTTPException
from app.models.cids import SpectrumResponse
from app.connectors import get_connector

router = APIRouter()


@router.get("/spectrum", response_model=SpectrumResponse)
async def spectrum(record_id: str = Query(...)) -> SpectrumResponse:
    """
    Return 102-band SED: wavelengths (μm), flux, variance.
    LVF pixel-to-wavelength mapping applied server-side.
    """
    connector = get_connector("qr3")
    if connector is None:
        raise HTTPException(status_code=503, detail="QR3 connector not available")
    return await connector.fetch_spectrum(record_id)

