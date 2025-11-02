"""Authentication service logic."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Sequence
from uuid import uuid4

from fastapi import HTTPException, status
from jose import JWTError, jwt
from loguru import logger
from pydantic import ValidationError
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..alerts.service import AlertService
from ..audit.service import record_event, suspicious_login_check
from ..config import Settings
from ..models import LoginAttempt, RefreshToken, Role, Session as SessionModel, User
from ..redis_client import (
    cache_refresh_jti,
    delete_refresh_jti,
    get_redis_client_by_url,
    is_refresh_jti_valid,
)
from ..schemas import LoginIn, RegisterIn, TokenPair
from ..security import (
    ALGORITHM,
    decode_token,
    ensure_token_type,
    generate_token_pair,
    hash_password,
    now_utc,
    verify_password,
)
from ..utils.ip import fingerprint
from ..utils.time import utcnow

FALLBACK_REFRESH_WARNING = "DEV relaxed: refresh store unavailable, rotation skipped"
FALLBACK_ACCESS_TTL_MINUTES = 5


class RefreshPersistenceError(Exception):
    """Raised when durable refresh persistence fails."""


def _as_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class AuthService:
    """Business logic for authentication flows."""

    def __init__(
        self,
        settings: Settings,
        db: Session,
        redis: Optional[Redis] = None,
        alert_service: Optional[AlertService] = None,
    ):
        self.settings = settings
        self.db = db
        self._redis_override = redis
        self.alert_service = alert_service or AlertService(settings)

    async def _get_redis_client(self) -> Optional[Redis]:
        if self._redis_override is not None:
            return self._redis_override
        if not self.settings.redis_url:
            return None
        try:
            return await get_redis_client_by_url(self.settings.redis_url)
        except Exception as exc:
            logger.warning("Unable to obtain Redis client: {}", exc)
            return None

    def _default_role(self) -> Role:
        role = self.db.execute(select(Role).where(Role.name == "user")).scalar_one_or_none()
        if not role:
            role = Role(name="user")
            self.db.add(role)
            self.db.flush()
        return role

    async def register(self, payload: RegisterIn, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        """Register a new user with default role."""
        try:
            existing = self.db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

            user = User(
                email=payload.email.lower(),
                password_hash=hash_password(payload.password),
                is_active=True,
            )
            user.roles.append(self._default_role())
            self.db.add(user)
            self.db.flush()

            token_pair = await self._issue_tokens_with_persistence(
                user=user,
                ip=ip,
                user_agent=user_agent,
                device_fingerprint=None,
                event="user.register",
            )
            self.db.commit()
            return user, token_pair
        except HTTPException:
            self.db.rollback()
            raise
        except (ValidationError, IntegrityError, ValueError) as exc:
            self.db.rollback()
            logger.exception("Registration validation error: {}", exc)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid registration request")
        except RefreshPersistenceError as exc:
            self.db.rollback()
            logger.exception("Refresh persistence failure during registration: {}", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")
        except Exception as exc:  # pragma: no cover - unexpected
            self.db.rollback()
            logger.exception("Unexpected registration error: {}", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")

    async def login(self, payload: LoginIn, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        try:
            user = self.db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
            if not user or not verify_password(payload.password, user.password_hash):
                self._record_login_attempt(payload.email, ip, user_agent, success=False)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

            self._record_login_attempt(payload.email, ip, user_agent, success=True)

            token_pair = await self._issue_tokens_with_persistence(
                user=user,
                ip=ip,
                user_agent=user_agent,
                device_fingerprint=payload.device_fingerprint,
                event="user.login",
            )
            self.db.commit()
            return user, token_pair
        except HTTPException:
            self.db.rollback()
            raise
        except RefreshPersistenceError as exc:
            self.db.rollback()
            logger.exception("Refresh persistence failure during login: {}", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")
        except ValidationError as exc:
            self.db.rollback()
            logger.exception("Login validation error: {}", exc)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid login request")
        except Exception as exc:  # pragma: no cover - unexpected
            self.db.rollback()
            logger.exception("Unexpected login error: {}", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")

    async def refresh(self, refresh_token: str, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        try:
            payload = decode_token(refresh_token, self.settings)
            ensure_token_type(payload, "refresh")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        jti = payload.get("jti")
        user_id = payload.get("sub")
        if not jti or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or revoked")

        user = self.db.get(User, int(user_id))
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or revoked")

        redis_required = self.settings.refresh_persistence == "redis"
        redis_client: Optional[Redis] = self._redis_override if redis_required else None
        did_fallback = False

        if redis_required:
            if redis_client is None:
                try:
                    redis_client = await self._get_redis_client()
                except Exception as exc:
                    logger.warning("Redis validation unavailable for refresh {}: {}", jti, exc)
                    if not self.settings.dev_relaxed_mode:
                        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc
                    did_fallback = True
                    redis_client = None

            if redis_client is None:
                if not self.settings.dev_relaxed_mode:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")
                logger.warning("Redis client unavailable; continuing with DB lookup")
            else:
                try:
                    cache_hit = await is_refresh_jti_valid(jti, client=redis_client)
                    if cache_hit:
                        logger.info("Refresh token {} validated via Redis cache", jti)
                    else:
                        logger.info("Refresh token {} cache miss; consulting database", jti)
                except Exception as exc:
                    logger.warning("Redis validation failure for refresh {}: {}", jti, exc)
                    if not self.settings.dev_relaxed_mode:
                        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc
                    redis_client = None
                    did_fallback = True

        try:
            record = (
                self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
                .scalars()
                .one_or_none()
            )
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.exception("Database lookup failed for refresh {}: {}", jti, exc)
            if self.settings.dev_relaxed_mode:
                logger.warning("DEV relaxed mode active; issuing access token without rotation")
                fallback = self._fallback_access_only(
                    user=user,
                    roles=payload.get("roles") or self._role_names(user),
                    ip=ip,
                    user_agent=user_agent,
                    event="user.refresh",
                    refresh_token=refresh_token,
                    refresh_expires_at=payload.get("exp"),
                )
                self.db.commit()
                return user, fallback
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc

        now = _as_aware_utc(utcnow())
        exp = _as_aware_utc(record.expires_at) if record else None
        revoked_at = _as_aware_utc(record.revoked_at) if record else None

        if (
            record is None
            or record.user_id != user.id
            or revoked_at is not None
            or exp is None
            or exp <= now
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token invalid or revoked",
            )

        old_jti = record.jti
        roles = payload.get("roles") or self._role_names(user)

        try:
            record.revoked_at = datetime.now(timezone.utc)
            new_pair = await self._issue_tokens_with_persistence(
                user=user,
                ip=ip,
                user_agent=user_agent,
                device_fingerprint=None,
                event="user.refresh",
                redis_client=redis_client,
            )

            if redis_required and redis_client:
                try:
                    await delete_refresh_jti(old_jti, client=redis_client)
                except Exception as exc:
                    logger.warning("Failed to delete cached refresh {}: {}", old_jti, exc)
                    if not self.settings.dev_relaxed_mode:
                        raise RefreshPersistenceError("Unable to delete cached refresh token") from exc
                    did_fallback = True

            self.db.commit()
            if did_fallback and getattr(new_pair, "warning", None) is None:
                new_pair.warning = FALLBACK_REFRESH_WARNING
            return user, new_pair
        except RefreshPersistenceError as exc:
            self.db.rollback()
            if self.settings.dev_relaxed_mode:
                logger.warning("DEV relaxed rotation fallback for {}: {}", old_jti, exc)
                fallback = self._fallback_access_only(
                    user=user,
                    roles=roles,
                    ip=ip,
                    user_agent=user_agent,
                    event="user.refresh",
                    refresh_token=refresh_token,
                    refresh_expires_at=payload.get("exp"),
                )
                self.db.commit()
                return user, fallback
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc
        except Exception as exc:  # pragma: no cover - unexpected
            self.db.rollback()
            logger.exception("Unexpected refresh rotation error: {}", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")

    async def logout(self, refresh_token: str, user: User) -> None:
        try:
            payload = decode_token(refresh_token, self.settings)
            ensure_token_type(payload, "refresh")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        jti = payload.get("jti")
        if not jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        redis_required = self.settings.refresh_persistence == "redis"
        redis_client: Optional[Redis] = self._redis_override if redis_required else None
        if redis_required:
            try:
                redis_client = await self._get_redis_client()
            except Exception as exc:
                logger.warning("Redis unavailable during logout: {}", exc)
                if not self.settings.dev_relaxed_mode:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc
                redis_client = None
            if redis_client is None and not self.settings.dev_relaxed_mode:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")

        record = (
            self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
            .scalars()
            .one_or_none()
        )

        if record:
            record.revoked_at = datetime.now(timezone.utc)

        if redis_required and redis_client is not None:
            try:
                await delete_refresh_jti(jti, client=redis_client)
            except Exception as exc:
                logger.warning("Failed to delete refresh cache during logout: {}", exc)
                if not self.settings.dev_relaxed_mode:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable") from exc

        session = (
            self.db.execute(
                select(SessionModel)
                .where(SessionModel.user_id == user.id)
                .order_by(SessionModel.created_at.desc())
            )
            .scalars()
            .first()
        )
        if session:
            session.active = False
            session.last_seen_at = utcnow()

        record_event(self.db, self.settings, "user.logout", user, None, None, metadata=None)
        self.db.commit()

    def _record_login_attempt(self, email: str, ip: str, user_agent: str, success: bool) -> None:
        attempt = LoginAttempt(email=email, ip=ip, user_agent=user_agent, success=success)
        self.db.add(attempt)

    def _role_names(self, user: User) -> Sequence[str]:
        return [role.name for role in user.roles]

    async def _issue_tokens_with_persistence(
        self,
        user: User,
        ip: Optional[str],
        user_agent: Optional[str],
        device_fingerprint: Optional[str],
        event: str,
        redis_client: Optional[Redis] = None,
    ) -> TokenPair:
        roles = self._role_names(user)
        token_result = generate_token_pair(user.id, roles, self.settings)
        issued_at = now_utc()

        refresh_record = RefreshToken(
            user_id=user.id,
            jti=token_result.refresh_jti,
            issued_at=issued_at,
            expires_at=token_result.refresh_expires_at,
            revoked_at=None,
            ip=ip,
            user_agent=user_agent,
        )

        session_fp = fingerprint(ip or "unknown", user_agent or "unknown", device_fingerprint)
        session_entry = SessionModel(
            user_id=user.id,
            created_at=issued_at,
            last_seen_at=issued_at,
            ip=ip,
            user_agent=user_agent,
            device_fingerprint=session_fp,
            active=True,
        )

        try:
            self.db.add(refresh_record)
            self.db.add(session_entry)
            self.db.flush()
        except SQLAlchemyError as exc:
            raise RefreshPersistenceError("Failed to persist refresh token to database") from exc

        prev_ip = user.last_login_ip
        prev_ua = user.last_login_ua
        user.last_login_at = issued_at
        user.last_login_ip = ip
        user.last_login_ua = user_agent

        susp = suspicious_login_check(prev_ip, prev_ua, ip, user_agent)
        metadata = {
            "roles": roles,
            "session_id": session_entry.id,
            "refresh_jti": token_result.refresh_jti,
            "severity": susp.severity,
            "reason": susp.reason,
            "fallback": False,
        }

        redis_required = self.settings.refresh_persistence == "redis"
        active_redis = redis_client if redis_required else None

        if redis_required:
            if active_redis is None:
                try:
                    active_redis = await self._get_redis_client()
                except Exception as exc:
                    logger.warning("Redis persistence lookup failed: {}", exc)
                    active_redis = None
                if active_redis is None:
                    if not self.settings.dev_relaxed_mode:
                        raise RefreshPersistenceError("Redis persistence required but unavailable")
                    logger.warning("Redis persistence unavailable; continuing with DB-only storage")

        if active_redis is not None:
            ttl_seconds = max(int((token_result.refresh_expires_at - issued_at).total_seconds()), 1)
            try:
                await cache_refresh_jti(
                    token_result.refresh_jti,
                    user.id,
                    ttl_seconds,
                    client=active_redis,
                )
            except Exception as exc:
                logger.warning("Failed to cache refresh token {}: {}", token_result.refresh_jti, exc)
                if not self.settings.dev_relaxed_mode:
                    raise RefreshPersistenceError("Redis persistence failed") from exc
            redis_client = active_redis

        record_event(
            self.db,
            self.settings,
            event,
            user,
            ip,
            user_agent,
            metadata=metadata,
            alert_service=self.alert_service,
        )

        return TokenPair(
            access_token=token_result.access_token,
            refresh_token=token_result.refresh_token,
            expires_in=max(1, int((token_result.access_expires_at - issued_at).total_seconds())),
            refresh_expires_in=max(1, int((token_result.refresh_expires_at - issued_at).total_seconds())),
        )

    def _fallback_access_only(
        self,
        user: User,
        roles: Sequence[str],
        ip: Optional[str],
        user_agent: Optional[str],
        event: str,
        refresh_token: Optional[str] = "",
        refresh_expires_at: Optional[int] = None,
    ) -> TokenPair:
        issued_at = utcnow()
        access_token = jwt.encode(
            {
                "sub": str(user.id),
                "roles": list(roles),
                "jti": str(uuid4()),
                "type": "access",
                "iat": int(issued_at.timestamp()),
                "exp": int((issued_at + timedelta(minutes=FALLBACK_ACCESS_TTL_MINUTES)).timestamp()),
            },
            self.settings.secret_key,
            algorithm=ALGORITHM,
        )

        prev_ip = user.last_login_ip
        prev_ua = user.last_login_ua
        user.last_login_at = issued_at
        user.last_login_ip = ip
        user.last_login_ua = user_agent

        susp = suspicious_login_check(prev_ip, prev_ua, ip, user_agent)
        metadata = {
            "roles": list(roles),
            "session_id": None,
            "refresh_jti": None,
            "severity": susp.severity,
            "reason": susp.reason or "Refresh persistence unavailable; fallback issued",
            "fallback": True,
        }

        record_event(
            self.db,
            self.settings,
            event,
            user,
            ip,
            user_agent,
            metadata=metadata,
            alert_service=self.alert_service,
        )

        refresh_expires_in = 0
        if refresh_token and refresh_expires_at:
            refresh_expires_in = max(0, refresh_expires_at - int(issued_at.timestamp()))

        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token or "",
            expires_in=FALLBACK_ACCESS_TTL_MINUTES * 60,
            refresh_expires_in=refresh_expires_in,
            warning=FALLBACK_REFRESH_WARNING,
        )

    async def me(self, user: User) -> User:
        return user

    async def two_factor_placeholder(self, user: User) -> dict:
        """Placeholder for future 2FA integration."""
        return {"status": "not-implemented"}
