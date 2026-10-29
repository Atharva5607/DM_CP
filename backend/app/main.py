from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import router
from .core.config import CORS_ORIGINS
from .core.errors import NotFoundError, ValidationError


def create_app() -> FastAPI:
    app = FastAPI(
        title="NexusGraph API",
        description="Multi-layer graph decision support for infrastructure dependency analysis.",
        version="1.0.0",
    )
    app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(NotFoundError)
    async def not_found(_: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def invalid(_: Request, exc: ValidationError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    app.include_router(router)
    return app


app = create_app()
