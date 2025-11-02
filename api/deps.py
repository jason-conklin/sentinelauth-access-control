"""FastAPI dependency functions."""

from __future__ import annotations

from typing import Callable, Iterable, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_session_factory
from .models import User
from .ratelimit import rate_limit_or_raise
from .redis_client import get_redis_client_by_url
from .security import decode_token, ensure_token_type
from .utils.ip import client_ip
from loguru import logger

bearer_scheme = HTTPBearer(auto_error=False)


def get_db(settings: Settings = Depends(get_settings)) -> Session:
    """Provide a database session."""
    session_factory = get_session_factory(settings)
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


async def get_redis(settings: Settings = Depends(get_settings)) -> Optional[Redis]:
    """Return a Redis client."""
    try:
        client = await get_redis_client_by_url(settings.redis_url)
    except Exception as exc:
        message = "Redis unavailable"
        if settings.dev_relaxed_mode:
            logger.warning("{}; proceeding due to dev_relaxed_mode ({})", message, exc)
            return None
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis unavailable") from exc
    if client is None:
        message = "Redis unavailable"
        if settings.dev_relaxed_mode:
            logger.warning("{}; proceeding due to dev_relaxed_mode (no client)", message)
            return None
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis unavailable")
    return client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate the user from a bearer token."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth required")
    token = credentials.credentials
    try:
        payload = decode_token(token, settings)
        ensure_token_type(payload, "access")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user: Optional[User] = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


def require_roles(*roles: str) -> Callable[[User], User]:
    """Dependency ensuring the current user has all specified roles."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        names = {role.name for role in user.roles}
        missing = [role for role in roles if role not in names]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required roles: {', '.join(missing)}",
            )
        return user

    return _checker


def require_any_role(*roles: str) -> Callable[[User], User]:
    """Dependency ensuring the user has at least one of the specified roles."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        names = {role.name for role in user.roles}
        if not names.intersection(roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role privileges",
            )
        return user

    return _checker


def rate_limit_dependency(
    bucket: str,
    capacity: int,
    period_seconds: int,
    detail: str,
) -> Callable[[Request, Redis], None]:
    """Factory for per-request rate limiting dependencies."""

    async def _rate_limit(
        request: Request,
        redis: Optional[Redis] = Depends(get_redis),
        settings: Settings = Depends(get_settings),
    ) -> None:
        ip = client_ip(request)
        key = f"rl:{bucket}:{ip}"
        await rate_limit_or_raise(settings, redis, key, capacity, period_seconds, detail)

    return _rate_limit
