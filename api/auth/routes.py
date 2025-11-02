"""Authentication API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..deps import get_current_user, get_db, get_redis, rate_limit_dependency
from ..models import Session as SessionModel, User
from ..schemas import (
    LoginIn,
    LogoutOut,
    RefreshIn,
    RegisterIn,
    SessionListOut,
    TokenPair,
    UserOut,
)
from ..ratelimit import rate_limit_or_raise
from ..utils.ip import client_ip, user_agent
from .service import AuthService

router = APIRouter()

register_rate_limit = rate_limit_dependency("register", capacity=3, period_seconds=60, detail="Too many registrations")
login_rate_limit = rate_limit_dependency("login", capacity=5, period_seconds=60, detail="Too many login attempts")


def _service(
    settings: Settings,
    db: Session,
    redis: Redis,
) -> AuthService:
    return AuthService(settings=settings, db=db, redis=redis)


@router.post("/register", response_model=TokenPair, dependencies=[Depends(register_rate_limit)])
async def register(
    payload: RegisterIn,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenPair:
    ip = client_ip(request)
    ua = user_agent(request)
    service = _service(settings, db, redis)
    await rate_limit_or_raise(
        settings,
        redis,
        key=f"register:{payload.email.lower()}",
        capacity=3,
        period_seconds=300,
        detail="Too many registration attempts for this email",
    )
    _, tokens = await service.register(payload, ip, ua)
    return tokens


@router.post("/login", response_model=TokenPair, dependencies=[Depends(login_rate_limit)])
async def login(
    payload: LoginIn,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenPair:
    ip = client_ip(request)
    ua = user_agent(request)
    await rate_limit_or_raise(
        settings,
        redis,
        key=f"login:{payload.email.lower()}:{ip}",
        capacity=5,
        period_seconds=300,
        detail="Too many login attempts",
    )
    _, tokens = await _service(settings, db, redis).login(payload, ip, ua)
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshIn,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenPair:
    ip = client_ip(request)
    ua = user_agent(request)
    _, tokens = await _service(settings, db, redis).refresh(payload.refresh_token, ip, ua)
    return tokens


@router.post("/logout", response_model=LogoutOut)
async def logout(
    payload: RefreshIn,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> LogoutOut:
    await _service(settings, db, redis).logout(payload.refresh_token, current_user)
    return LogoutOut()


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_orm(current_user)


@router.get("/me/sessions", response_model=SessionListOut)
async def my_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionListOut:
    sessions = (
        db.execute(
            select(SessionModel)
            .where(SessionModel.user_id == current_user.id)
            .order_by(SessionModel.created_at.desc())
        )
        .scalars()
        .all()
    )
    return SessionListOut(sessions=sessions)
