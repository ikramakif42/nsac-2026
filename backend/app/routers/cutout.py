from fastapi import APIRouter, HTTPException, Query, Response

from app.connectors import get_connector
from app.models.cids import DataSource, ObservationRecord

router = APIRouter()


def connector_for(source: DataSource):
    connector = get_connector(source)
    if connector is None:
        raise HTTPException(503, f"Connector '{source}' not available")
    return connector


@router.get("/cutout", response_model=ObservationRecord)
async def cutout(
    record_id: str = Query(..., min_length=1, max_length=512),
    ra: float = Query(..., ge=0, lt=360),
    dec: float = Query(..., ge=-90, le=90),
    band: str = Query(..., min_length=1, max_length=64),
    source: DataSource = Query("qr3"),
) -> ObservationRecord:
    """Return CIDS metadata for a cutout; fits_url addresses its validated MEF."""
    return await connector_for(source).fetch_cutout(record_id, ra, dec, band)


@router.get("/cutout/fits")
async def cutout_fits(
    record_id: str = Query(..., min_length=1, max_length=512),
    ra: float = Query(..., ge=0, lt=360),
    dec: float = Query(..., ge=-90, le=90),
    band: str = Query(..., min_length=1, max_length=64),
    source: DataSource = Query("qr3"),
) -> Response:
    """Deliver HDU 1 science, HDU 2 variance and HDU 3 uint16 bitmask."""
    connector = connector_for(source)
    fetch = getattr(connector, "fetch_fits", None)
    if fetch is None:
        raise HTTPException(422, f"Connector '{source}' does not expose FITS products.")
    payload = await fetch(record_id, ra, dec, band)
    return Response(
        content=payload,
        media_type="application/fits",
        headers={
            "Content-Disposition": 'inline; filename="orbit-lens-cutout.fits"',
            "X-Data-Source": source,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=300",
        },
    )