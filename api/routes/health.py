"""Health check endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from ..config import Settings, get_settings
from ..db import get_engine
from ..redis_client import get_redis_client_by_url
from ..schemas import HealthResponse

router = APIRouter()


@router.get("", response_model=HealthResponse, summary="Service health status")
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    warnings: List[str] = []

    db_ok = True
    try:
        engine = get_engine(settings)
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except Exception:
        logger.exception("Database health check failed")
        db_ok = False
        if settings.dev_relaxed_mode:
            warnings.append("Database unavailable")

    redis_ok = False
    try:
        client = await get_redis_client_by_url(settings.redis_url)
        if client:
            await client.ping()
            redis_ok = True
        else:
            raise RuntimeError("Redis client unavailable")
    except Exception:
        logger.exception("Redis health check failed")
        if settings.dev_relaxed_mode:
            warnings.append("Redis unavailable")

    redis_required = settings.refresh_persistence == "redis"

    if not db_ok:
        status_text = "degraded" if settings.dev_relaxed_mode else "error"
    elif redis_ok or not redis_required:
        status_text = "ok" if redis_ok else "degraded"
    else:
        status_text = "degraded" if settings.dev_relaxed_mode else "error"

    if status_text != "ok" and settings.dev_relaxed_mode and not warnings:
        if not db_ok:
            warnings.append("Database unavailable")
        elif not redis_ok:
            warnings.append("Redis unavailable")

    response = HealthResponse(
        status=status_text,
        db_ok=db_ok,
        redis_ok=redis_ok,
        warnings=(warnings or None) if settings.dev_relaxed_mode else None,
    )

    if status_text == "error":
        raise HTTPException(
            status_code=503,
            detail=response.dict(exclude_none=True),
        )

    return response
