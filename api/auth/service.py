"""Authentication service logic."""

from __future__ import annotations

from typing import Optional, Tuple

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..alerts.service import AlertService
from ..audit.service import record_event, suspicious_login_check
from ..config import Settings
from ..models import LoginAttempt, RefreshToken, Role, Session as SessionModel, User
from ..schemas import LoginIn, RegisterIn, TokenPair
from ..security import (
    generate_token_pair,
    get_redis_client,
    hash_password,
    register_refresh_token,
    revoke_refresh_token,
    verify_password,
    verify_refresh_token_active,
)
from ..utils.ip import fingerprint
from ..utils.time import utcnow


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
        self.redis = redis or get_redis_client(settings)
        self.alert_service = alert_service or AlertService(settings)

    def _default_role(self) -> Role:
        role = self.db.execute(select(Role).where(Role.name == "user")).scalar_one_or_none()
        if not role:
            role = Role(name="user")
            self.db.add(role)
            self.db.flush()
        return role

    async def register(self, payload: RegisterIn, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        """Register a new user with default role."""
        existing = self.db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

        user = User(
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            is_active=True,
        )
        role = self._default_role()
        user.roles.append(role)
        self.db.add(user)
        self.db.flush()

        token_pair = await self._issue_tokens(user, ip, user_agent, device_fingerprint=None, event="user.register")
        self.db.commit()
        return user, token_pair

    async def login(self, payload: LoginIn, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        user = self.db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
        if not user or not verify_password(payload.password, user.password_hash):
            self._record_login_attempt(payload.email, ip, user_agent, success=False)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

        self._record_login_attempt(payload.email, ip, user_agent, success=True)

        token_pair = await self._issue_tokens(
            user,
            ip,
            user_agent,
            device_fingerprint=payload.device_fingerprint,
            event="user.login",
        )
        self.db.commit()
        return user, token_pair

    async def refresh(self, refresh_token: str, ip: str, user_agent: str) -> Tuple[User, TokenPair]:
        from ..security import decode_token, ensure_token_type

        payload = decode_token(refresh_token, self.settings)
        ensure_token_type(payload, "refresh")
        jti = payload["jti"]
        user_id = int(payload["sub"])

        db_token: Optional[RefreshToken] = self.db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        ).scalar_one_or_none()

        if db_token is None or db_token.is_revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
        if db_token.expires_at and db_token.expires_at < utcnow():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

        active = await verify_refresh_token_active(self.redis, jti)
        if not active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

        user = self.db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

        db_token.is_revoked = True
        await revoke_refresh_token(self.redis, jti)

        token_pair = await self._issue_tokens(
            user,
            ip,
            user_agent,
            device_fingerprint=None,
            event="user.refresh",
        )
        self.db.commit()
        return user, token_pair

    async def logout(self, refresh_token: str, user: User) -> None:
        from ..security import decode_token, ensure_token_type

        payload = decode_token(refresh_token, self.settings)
        ensure_token_type(payload, "refresh")
        jti = payload["jti"]
        db_token: Optional[RefreshToken] = self.db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        ).scalar_one_or_none()
        if db_token:
            db_token.is_revoked = True
            await revoke_refresh_token(self.redis, jti)

        session = (
            self.db.execute(
                select(SessionModel)
                .where(SessionModel.user_id == user.id)
                .order_by(SessionModel.created_at.desc())
            ).scalars().first()
        )
        if session:
            session.active = False
            session.last_seen_at = utcnow()

        record_event(self.db, self.settings, "user.logout", user, None, None, metadata=None)
        self.db.commit()

    async def _issue_tokens(
        self,
        user: User,
        ip: Optional[str],
        user_agent: Optional[str],
        device_fingerprint: Optional[str],
        event: str,
    ) -> TokenPair:
        """Create token pair, persist refresh token, session, and audit trail."""
        roles = [role.name for role in user.roles]
        token_result = generate_token_pair(user.id, roles, self.settings)

        prev_ip = user.last_login_ip
        prev_ua = user.last_login_ua

        refresh_entry = RefreshToken(
            user_id=user.id,
            jti=token_result.refresh_jti,
            issued_at=utcnow(),
            expires_at=token_result.refresh_expires_at,
            ip=ip,
            user_agent=user_agent,
            is_revoked=False,
        )
        self.db.add(refresh_entry)

        session_fp = device_fingerprint or fingerprint(ip or "unknown", user_agent or "unknown", device_fingerprint)
        session_entry = SessionModel(
            user_id=user.id,
            created_at=utcnow(),
            last_seen_at=utcnow(),
            ip=ip,
            user_agent=user_agent,
            device_fingerprint=session_fp,
            active=True,
        )
        self.db.add(session_entry)
        self.db.flush()

        await register_refresh_token(self.redis, token_result.refresh_jti, token_result.refresh_expires_at, user.id)

        user.last_login_at = utcnow()
        user.last_login_ip = ip
        user.last_login_ua = user_agent

        susp = suspicious_login_check(prev_ip, prev_ua, ip, user_agent)
        metadata = {
            "roles": roles,
            "session_id": session_entry.id,
            "refresh_jti": token_result.refresh_jti,
            "severity": susp.severity,
            "reason": susp.reason,
        }
        record_event(self.db, self.settings, event, user, ip, user_agent, metadata=metadata, alert_service=self.alert_service)

        return TokenPair(
            access_token=token_result.access_token,
            refresh_token=token_result.refresh_token,
            expires_in=max(1, int((token_result.access_expires_at - utcnow()).total_seconds())),
            refresh_expires_in=max(1, int((token_result.refresh_expires_at - utcnow()).total_seconds())),
        )

    def _record_login_attempt(self, email: str, ip: str, user_agent: str, success: bool) -> None:
        attempt = LoginAttempt(
            email=email,
            ip=ip,
            user_agent=user_agent,
            success=success,
        )
        self.db.add(attempt)

    async def me(self, user: User) -> User:
        return user

    async def two_factor_placeholder(self, user: User) -> dict:
        """Placeholder for future 2FA integration."""
        return {"status": "not-implemented"}
