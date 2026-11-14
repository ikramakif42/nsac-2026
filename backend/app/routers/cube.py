import asyncio
import json

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.connectors import get_connector
from app.models.cids import CubeAxis, DataSource, TimeCubeMetadata
from app.science.cube_render import (
    CubeInputError,
    CubeRenderRequest,
    build_cube_render,
)

router = APIRouter()

MAX_REQUEST_BYTES = 48 * 1024 * 1024
_render_slots = asyncio.Semaphore(2)


@router.get("/cube", response_model=TimeCubeMetadata)
async def get_cube(
    record_id: str = Query(...),
    axis: CubeAxis = Query(default="time"),
    source: DataSource = Query(default="synthetic"),
) -> TimeCubeMetadata:
    """Preserve the existing connector-owned CIDS metadata endpoint."""
    connector = get_connector(source)
    if connector is None:
        raise HTTPException(
            status_code=503,
            detail=f"Connector '{source}' not available",
        )
    return await connector.fetch_cube(record_id, axis)


@router.post("/cube/render")
async def render_cube(request: Request) -> dict:
    """Register supplied CIDS observations without archive or synthetic fallback."""
    content_type = request.headers.get("content-type", "").split(";")[0].strip()
    if content_type != "application/json":
        raise HTTPException(status_code=415, detail="application/json is required.")

    async with _render_slots:
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_REQUEST_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Cube request exceeds 48 MiB. Use smaller cutouts.",
                )
            body.extend(chunk)

        try:
            raw = json.loads(body)
            payload = CubeRenderRequest.model_validate(raw)
        except (ValueError, UnicodeDecodeError, ValidationError) as exc:
            raise HTTPException(
                status_code=422,
                detail="Invalid cube request structure or values.",
            ) from exc
        finally:
            body.clear()

        try:
            return await run_in_threadpool(build_cube_render, payload)
        except CubeInputError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except (ValueError, TypeError, ArithmeticError) as exc:
            raise HTTPException(
                status_code=422,
                detail="The supplied observations cannot form a valid celestial cube.",
            ) from exc