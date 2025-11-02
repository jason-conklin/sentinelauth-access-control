"""SQLAlchemy models for SentinelAuth."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    JSON,
)
from sqlalchemy.orm import relationship

from .db import Base


class TimestampMixin:
    """Common timestamp columns."""

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class User(Base, TimestampMixin):
    """Registered user."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(64), nullable=True)
    last_login_ua = Column(String(512), nullable=True)

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    sessions = relationship("Session", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class Role(Base):
    """Role definition."""

    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False)

    users = relationship("User", secondary="user_roles", back_populates="roles")


class UserRole(Base):
    """Join table between users and roles."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)


class RefreshToken(Base):
    """Stored refresh tokens for rotation/revocation tracking."""

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String(128), nullable=False, unique=True, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")


class Session(Base):
    """Active user session."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    device_fingerprint = Column(String(128), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="sessions")


class AuditEvent(Base):
    """Audit trail for sensitive events."""

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True)
    ts = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(128), nullable=False, index=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    metadata = Column(JSON, nullable=True)

    user = relationship("User")


class LoginAttempt(Base):
    """Login attempt history for anomaly detection."""

    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True)
    ts = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    email = Column(String(255), nullable=False, index=True)
    ip = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    success = Column(Boolean, default=False, nullable=False)


def user_role_names(user: Optional[User]) -> list[str]:
    """Return the role names for a user."""
    if not user:
        return []
    return [role.name for role in user.roles]
