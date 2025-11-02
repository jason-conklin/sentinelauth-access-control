"""Pydantic schemas for request and response models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, EmailStr, Field, constr, validator


class ErrorResponse(BaseModel):
    """Standard error model."""

    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    db_ok: bool
    redis_ok: bool
    warnings: Optional[List[str]] = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: constr(min_length=8)  # type: ignore[valid-type]


class LoginIn(BaseModel):
    email: EmailStr
    password: constr(min_length=8)  # type: ignore[valid-type]
    device_fingerprint: Optional[str] = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token expiry in seconds.")
    refresh_expires_in: int = Field(..., description="Refresh token expiry in seconds.")
    warning: Optional[str] = Field(None, description="Informational warning for degraded modes.")


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutOut(BaseModel):
    detail: str = "logged out"


class RoleOut(BaseModel):
    name: str

    class Config:
        orm_mode = True


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    roles: List[str]
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    last_login_ua: Optional[str] = None

    class Config:
        orm_mode = True

    @validator("roles", pre=True)
    def parse_roles(cls, value: Any) -> List[str]:
        if isinstance(value, list):
            return [getattr(role, "name", role) for role in value]
        return value


class UserListOut(BaseModel):
    users: List[UserOut]


class AssignRoleIn(BaseModel):
    role: str
    action: constr(regex="^(add|remove)$")  # type: ignore[valid-type]


class UserUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    password: Optional[constr(min_length=8)] = None  # type: ignore[valid-type]


class SessionOut(BaseModel):
    id: int
    user_id: int
    created_at: datetime
    last_seen_at: datetime
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    device_fingerprint: Optional[str] = None
    active: bool

    class Config:
        orm_mode = True


class SessionListOut(BaseModel):
    sessions: List[SessionOut]


class AuditEventOut(BaseModel):
    id: int
    ts: datetime
    user_id: Optional[int] = None
    event_type: str
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    meta: Optional[Dict[str, Any]] = Field(None, alias="metadata")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class AuditListOut(BaseModel):
    events: List[AuditEventOut]


class LoginAttemptOut(BaseModel):
    ts: datetime
    email: EmailStr
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    success: bool


class DashboardSummary(BaseModel):
    user_count: int
    active_sessions: int
    audit_last_24h: int
