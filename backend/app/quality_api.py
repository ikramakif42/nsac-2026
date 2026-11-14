"""Bounded FITS-upload API for M3.

The endpoint does not fetch caller-supplied URLs, preventing an additional
server-side request-forgery surface. The browser transports existing FITS
bytes; Astropy and NumPy own all parsing and quality calculations.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Literal

from astropy.io.fits.verify import VerifyError
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.science.fits_engine import FITSValidationError
from app.science.quality_products import (
    MAX_UPLOAD_BYTES,
    build_quality_payload,
)

logger = logging.getLogger(__name__)

quality_app = FastAPI(
    title="ORBIT-LENS M3 Quality API",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# A worker can hold a bounded upload and its calculated products.
_slots = asyncio.Semaphore(2)


def _process(
    raw: bytes,
    record_id: str,
    source: Literal["qr3", "synthetic", "mast", "vizier"],
) -> dict:
    with tempfile.TemporaryDirectory(prefix="orbit-lens-quality-") as folder:
        path = Path(folder) / "input.fits"
        path.write_bytes(raw)
        return build_quality_payload(
            path,
            record_id=record_id,
            source=source,
        )


@quality_app.post("/api/quality")
async def inspect_quality(
    request: Request,
    record_id: str = Query(min_length=1, max_length=512),
    source: Literal["qr3", "synthetic", "mast", "vizier"] = Query(...),
) -> JSONResponse:
    content_type = request.headers.get("content-type", "").split(";")[0].lower()
    if content_type not in (
        "application/fits",
        "image/fits",
        "application/octet-stream",
    ):
        raise HTTPException(
            status_code=415,
            detail="Send raw FITS bytes with Content-Type: application/fits.",
        )

    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_size = int(content_length)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid Content-Length.",
            ) from exc
        if declared_size < 0:
            raise HTTPException(status_code=400, detail="Invalid Content-Length.")
        if declared_size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="FITS upload exceeds 64 MiB.")

    try:
        await asyncio.wait_for(_slots.acquire(), timeout=0.05)
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=429,
            detail="Quality workers are busy. Retry this inspection.",
            headers={"Retry-After": "2"},
        ) from exc

    try:
        chunks = bytearray()
        async for chunk in request.stream():
            if len(chunks) + len(chunk) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="FITS upload exceeds 64 MiB.",
                )
            chunks.extend(chunk)

        if not chunks:
            raise HTTPException(status_code=422, detail="The FITS upload is empty.")

        raw = bytes(chunks)
        del chunks

        try:
            # Starlette's worker execution waits for the computation to finish
            # before releasing this request's bounded worker slot.
            payload = await run_in_threadpool(
                _process,
                raw,
                record_id,
                source,
            )
        except (FITSValidationError, VerifyError, ValueError, OSError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception:
            logger.exception("Unexpected M3 quality-processing failure")
            raise HTTPException(
                status_code=500,
                detail="Quality processing failed. No replacement data was used.",
            )

        return JSONResponse(
            content=payload,
            headers={"Cache-Control": "no-store"},
        )
    finally:
        _slots.release()