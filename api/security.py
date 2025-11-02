"""Security utilities: password hashing, JWT handling, refresh management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Tuple
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt
from loguru import logger
from .config import Settings

ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def _base_claims(
    subject: str,
    roles: Iterable[str],
    token_type: str,
    jti: str,
    expires_at: datetime,
) -> Dict[str, Any]:
    return {
        "sub": subject,
        "roles": list(roles),
        "jti": jti,
        "type": token_type,
        "iat": int(now_utc().timestamp()),
        "exp": int(expires_at.timestamp()),
    }


def create_access_token(user_id: int, roles: Iterable[str], settings: Settings) -> Tuple[str, str, datetime]:
    """Create a signed access token."""
    jti = str(uuid4())
    expires_at = now_utc() + timedelta(minutes=settings.access_token_ttl_min)
    payload = _base_claims(str(user_id), roles, "access", jti, expires_at)
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, jti, expires_at


def create_refresh_token(user_id: int, roles: Iterable[str], settings: Settings) -> Tuple[str, str, datetime]:
    """Create a signed refresh token."""
    jti = str(uuid4())
    expires_at = now_utc() + timedelta(days=settings.refresh_token_ttl_days)
    payload = _base_claims(str(user_id), roles, "refresh", jti, expires_at)
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, jti, expires_at


def decode_token(token: str, settings: Settings) -> Dict[str, Any]:
    """Decode and validate a JWT."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        logger.debug("Token verification failed: {}", exc)
        raise


def ensure_token_type(payload: Dict[str, Any], expected_type: str) -> None:
    """Validate the token type contained within the payload."""
    if payload.get("type") != expected_type:
        raise JWTError(f"Expected token type '{expected_type}' found '{payload.get('type')}'")


@dataclass
class TokenPairResult:
    """Represents a generated token pair and metadata."""

    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime
    access_jti: str
    refresh_jti: str


def generate_token_pair(user_id: int, roles: Iterable[str], settings: Settings) -> TokenPairResult:
    """Generate access and refresh tokens for a given user."""
    access_token, access_jti, access_exp = create_access_token(user_id, roles, settings)
    refresh_token, refresh_jti, refresh_exp = create_refresh_token(user_id, roles, settings)
    return TokenPairResult(
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires_at=access_exp,
        refresh_expires_at=refresh_exp,
        access_jti=access_jti,
        refresh_jti=refresh_jti,
    )
