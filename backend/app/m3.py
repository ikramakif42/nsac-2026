"""ASGI entry point preserving the existing application and its lifecycle.

Run:
    uvicorn app.m3:app

Only the new /api/quality path is dispatched here. Existing endpoints,
WebSockets, middleware, and lifespan handling remain with app.main:app.

Authentication applied only inside the existing application does not cover
the new path. Deploy both applications behind the same authentication proxy
when authentication is required.
"""

from starlette.types import ASGIApp, Receive, Scope, Send

from app.main import app as existing_app
from app.quality_api import quality_app


class M3Application:
    def __init__(self, existing: ASGIApp, quality: ASGIApp) -> None:
        self.existing = existing
        self.quality = quality

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if (
            scope["type"] == "http"
            and scope.get("path") == "/api/quality"
        ):
            await self.quality(scope, receive, send)
            return
        await self.existing(scope, receive, send)


app = M3Application(existing_app, quality_app)