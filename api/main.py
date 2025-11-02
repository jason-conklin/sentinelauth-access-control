"""FastAPI application setup."""

from __future__ import annotations

from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import get_settings
from .db import init_db
from .redis_client import close_all_cached_clients, get_redis_client_by_url


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup/shutdown lifecycle events."""
    settings = get_settings()
    logger.info("Starting SentinelAuth in {} mode", settings.app_env)

    await anyio.to_thread.run_sync(init_db, settings)
    redis = None
    try:
        redis = await get_redis_client_by_url(settings.redis_url)
        if redis:
            logger.info("Redis connection established")
    except Exception as exc:
        message = f"Redis unavailable during startup: {exc}"
        if settings.dev_relaxed_mode:
            logger.warning("{}; dev_relaxed_mode enabled, continuing", message)
            redis = None
        else:
            logger.error(message)
            raise HTTPException(status_code=503, detail="Redis unavailable") from exc
    if redis is None and settings.redis_url:
        message = "Redis unavailable during startup"
        if settings.dev_relaxed_mode:
            logger.warning("{}; dev_relaxed_mode enabled, continuing", message)
        else:
            logger.error(message)
            raise HTTPException(status_code=503, detail="Redis unavailable")
    try:
        yield
    finally:
        if redis:
            try:
                await redis.aclose()
            except Exception:
                pass
        await close_all_cached_clients()
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
    from .routes.health import router as health_router
    from .users.routes import router as users_router
    from .sessions.routes import router as sessions_router
    from .audit.routes import router as audit_router

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(health_router, prefix="/health", tags=["health"])
    app.include_router(users_router, prefix="/users", tags=["users"])
    app.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
    app.include_router(audit_router, prefix="/audit", tags=["audit"])

    return app


app = create_app()
