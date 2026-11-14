"""CDS reference imagery rendered onto a backend-defined celestial image plane."""

import asyncio
import hashlib
import io
import json
import time
from collections import OrderedDict
from typing import Literal
from urllib.parse import urlencode

import httpx
import numpy as np
from astropy.wcs import WCS
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.models.cids import WCSParameters

router = APIRouter()

SURVEYS = {
    "2mass": {
        "url": "https://alasky.cds.unistra.fr/2MASS/Color",
        "label": "2MASS J/H/Ks",
    },
    "allwise": {
        "url": "https://alasky.cds.unistra.fr/AllWISE/W1-W2",
        "label": "AllWISE W1/W2",
    },
    "gaia_dr3": {
        "url": "https://alasky.cds.unistra.fr/Gaia/DR3/I_355_gaiadr3",
        "label": "Gaia DR3",
    },
}

HIPS2FITS_URL = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits"
MAX_BYTES = 8 * 1024 * 1024
CACHE_BYTES = 32 * 1024 * 1024
CACHE_TTL = 600.0
CACHE_ENTRIES = 32

_cache: OrderedDict[str, tuple[float, bytes]] = OrderedDict()
_slots = asyncio.Semaphore(4)


class ReferenceRequest(BaseModel):
    overlay: Literal["2mass", "allwise", "gaia_dr3"]
    wcs: WCSParameters | None = None
    ra: float = Field(default=269.4521, ge=0, lt=360, allow_inf_nan=False)
    dec: float = Field(default=4.6934, ge=-90, le=90, allow_inf_nan=False)
    fov_deg: float = Field(default=5.0, gt=0, le=10, allow_inf_nan=False)
    width: int = Field(default=768, ge=16, le=2048)
    height: int = Field(default=768, ge=16, le=2048)


def target_header(request: ReferenceRequest) -> dict:
    """Construct an ICRS TAN WCS; integer pixels have FITS one-based centers."""
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.cunit = ["deg", "deg"]
    wcs.wcs.radesys = "ICRS"

    supplied = request.wcs
    if supplied is None:
        width, height = request.width, request.height
        scale = request.fov_deg / width
        wcs.wcs.crpix = [(width + 1) / 2, (height + 1) / 2]
        wcs.wcs.crval = [request.ra, request.dec]
        wcs.wcs.cdelt = [-scale, scale]
    else:
        width, height = supplied.naxis1, supplied.naxis2
        if not (1 <= width <= 2048 and 1 <= height <= 2048):
            raise ValueError("Reference images support dimensions from 1 to 2048 pixels.")
        if width * height > 2048 * 2048:
            raise ValueError("Reference image exceeds the pixel budget.")

        numeric = [
            supplied.crpix1, supplied.crpix2,
            supplied.crval1, supplied.crval2,
            supplied.cdelt1, supplied.cdelt2,
        ]
        if not np.isfinite(numeric).all():
            raise ValueError("WCS values must be finite.")
        if not 0 <= supplied.crval1 < 360 or not -90 <= supplied.crval2 <= 90:
            raise ValueError("WCS reference coordinates are outside their valid ranges.")

        wcs.wcs.crpix = [supplied.crpix1, supplied.crpix2]
        wcs.wcs.crval = [supplied.crval1, supplied.crval2]
        cd = [supplied.cd1_1, supplied.cd1_2, supplied.cd2_1, supplied.cd2_2]
        if any(value is not None for value in cd):
            if not all(value is not None for value in cd):
                raise ValueError("A CD matrix must include all four elements.")
            matrix = np.asarray(cd, dtype=float).reshape(2, 2)
            if not np.isfinite(matrix).all():
                raise ValueError("CD matrix values must be finite.")
            wcs.wcs.cd = matrix
        else:
            rotation = supplied.crota2 or 0.0
            if not np.isfinite(rotation):
                raise ValueError("WCS rotation must be finite.")
            wcs.wcs.cdelt = [supplied.cdelt1, supplied.cdelt2]
            wcs.wcs.crota = [0.0, rotation]

    matrix = wcs.pixel_scale_matrix
    if not np.isfinite(matrix).all() or abs(np.linalg.det(matrix)) < 1e-18:
        raise ValueError("The WCS transformation is singular.")

    # Force Astropy to validate the celestial transformation.
    world = wcs.all_pix2world(
        [[(width - 1) / 2, (height - 1) / 2]], 0
    )
    if not np.isfinite(world).all():
        raise ValueError("The WCS does not define a finite image center.")

    header = dict(wcs.to_header(relax=True))
    header.update({"NAXIS": 2, "NAXIS1": width, "NAXIS2": height})
    return header


def tool_links(header: dict) -> dict[str, str]:
    """Derive tool coordinates from the actual image center, not browser math."""
    wcs = WCS(header)
    ra, dec = wcs.all_pix2world(
        [[(header["NAXIS1"] - 1) / 2, (header["NAXIS2"] - 1) / 2]], 0
    )[0]
    coordinate = f"{ra % 360:.9f} {dec:+.9f}"
    return {
        "simbad": "https://simbad.cds.unistra.fr/simbad/sim-coo?" + urlencode({
            "Coord": coordinate,
            "CooFrame": "ICRS",
            "Radius": 2,
            "Radius.unit": "arcmin",
        }),
        "vizier": "https://vizier.cds.unistra.fr/viz-bin/VizieR?" + urlencode({
            "-c": coordinate,
            "-c.rs": 120,
        }),
        "aladin": "https://aladin.cds.unistra.fr/AladinLite/?" + urlencode({
            "target": coordinate,
            "fov": 0.1,
        }),
    }


def checked_header(request: ReferenceRequest) -> dict:
    try:
        return target_header(request)
    except (ValueError, TypeError, ArithmeticError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def cache_get(key: str) -> bytes | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    created, data = entry
    if time.monotonic() - created >= CACHE_TTL:
        del _cache[key]
        return None
    _cache.move_to_end(key)
    return data


def cache_put(key: str, data: bytes) -> None:
    _cache[key] = (time.monotonic(), data)
    _cache.move_to_end(key)
    while (
        len(_cache) > CACHE_ENTRIES
        or sum(len(item[1]) for item in _cache.values()) > CACHE_BYTES
    ):
        _cache.popitem(last=False)


async def fetch_image(parameters: dict) -> bytes:
    """Fetch only the fixed CDS service, with bounded time, concurrency and size."""
    async with _slots:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45.0, connect=10.0),
            follow_redirects=False,
        ) as client:
            async with client.stream(
                "GET", HIPS2FITS_URL, params=parameters
            ) as response:
                response.raise_for_status()
                media_type = response.headers.get("content-type", "").split(";")[0]
                if media_type not in ("image/jpeg", "image/jpg"):
                    raise ValueError("CDS did not return a JPEG reference image.")
                output = bytearray()
                async for chunk in response.aiter_bytes():
                    output.extend(chunk)
                    if len(output) > MAX_BYTES:
                        raise ValueError("CDS reference image exceeds the size limit.")
                if not output.startswith(b"\xff\xd8") or not output.endswith(b"\xff\xd9"):
                    raise ValueError("CDS returned an invalid JPEG payload.")
                return bytes(output)


@router.post("/cds/metadata")
async def metadata(request: ReferenceRequest) -> dict:
    header = checked_header(request)
    survey = SURVEYS[request.overlay]
    return {
        "overlay": request.overlay,
        "survey": survey["label"],
        "hips_url": survey["url"],
        "provider": "CDS HiPS / hips2fits",
        "width": header["NAXIS1"],
        "height": header["NAXIS2"],
        "pixel_origin": "top-left; FITS rows reversed for display",
        "wcs_header": header,
        "links": tool_links(header),
        "warning": (
            "Reference survey imagery is not a SPHEREx epoch or calibrated "
            "cross-survey photometry. No proper-motion propagation is applied."
        ),
    }


@router.post("/cds/render")
async def render(request: ReferenceRequest) -> Response:
    header = checked_header(request)
    parameters = {
        "hips": SURVEYS[request.overlay]["url"],
        "wcs": json.dumps(header, separators=(",", ":"), sort_keys=True),
        "format": "jpg",
    }
    key = hashlib.sha256(
        json.dumps(parameters, sort_keys=True).encode("utf-8")
    ).hexdigest()

    data = cache_get(key)
    if data is None:
        try:
            data = await fetch_image(parameters)
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504, detail="CDS reference imagery timed out."
            ) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="CDS reference imagery is unavailable; no substitute was used.",
            ) from exc
        cache_put(key, data)

    return Response(
        content=data,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, max-age=600",
            "ETag": f'"{key}"',
            "X-Content-Type-Options": "nosniff",
            "X-ORBIT-LENS-Reference": request.overlay,
        },
    )