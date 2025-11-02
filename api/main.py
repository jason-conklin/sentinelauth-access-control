"""FastAPI application setup."""

from __future__ import annotations

from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import get_settings
from .db import init_db
from .schemas import HealthResponse
from .security import get_redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup/shutdown lifecycle events."""
    settings = get_settings()
    logger.info("Starting SentinelAuth in {} mode", settings.app_env)

    await anyio.to_thread.run_sync(init_db, settings)
    redis = get_redis_client(settings)
    try:
        yield
    finally:
        await redis.aclose()
        logger.info("SentinelAuth shutdown complete")


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    tags_metadata = [
        {"name": "auth", "description": "Authentication & token endpoints"},
        {"name": "users", "description": "User management and RBAC"},
        {"name": "sessions", "description": "Session management"},
        {"name": "audit", "description": "Audit and security events"},
    ]

    app = FastAPI(
        title="SentinelAuth",
        description="Role-Based Access & Security Platform",
        version="0.1.0",
        openapi_tags=tags_metadata,
        lifespan=lifespan,
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True,
        )

    from .auth.routes import router as auth_router
    from .users.routes import router as users_router
    from .sessions.routes import router as sessions_router
    from .audit.routes import router as audit_router

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(users_router, prefix="/users", tags=["users"])
    app.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
    app.include_router(audit_router, prefix="/audit", tags=["audit"])

    @app.get("/health", response_model=HealthResponse, tags=["health"], summary="Health check")
    async def health() -> HealthResponse:
        return HealthResponse()

    return app


app = create_app()
