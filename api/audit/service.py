"""Audit logging services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import asyncio

from loguru import logger
from sqlalchemy.orm import Session

from ..alerts.service import AlertService
from ..config import Settings
from ..models import AuditEvent, User


@dataclass
class SuspiciousLoginResult:
    severity: str
    reason: Optional[str] = None

    def is_alertworthy(self) -> bool:
        return self.severity in {"medium", "high"}


def suspicious_login_check(
    previous_ip: Optional[str],
    previous_ua: Optional[str],
    new_ip: Optional[str],
    new_ua: Optional[str],
) -> SuspiciousLoginResult:
    """Very simple heuristic for suspicious logins."""
    reasons = []
    if previous_ip and new_ip and previous_ip != new_ip:
        reasons.append(f"IP changed from {previous_ip} to {new_ip}")
    if previous_ua and new_ua and previous_ua != new_ua:
        reasons.append("User agent changed")
    if not reasons:
        return SuspiciousLoginResult(severity="low")
    severity = "high" if len(reasons) > 1 else "medium"
    return SuspiciousLoginResult(severity=severity, reason="; ".join(reasons))


def record_event(
    session: Session,
    settings: Settings,
    event_type: str,
    user: Optional[User],
    ip: Optional[str],
    user_agent: Optional[str],
    metadata: Optional[Dict[str, Any]] = None,
    alert_service: Optional[AlertService] = None,
) -> None:
    """Persist an audit event and dispatch alerts if necessary."""
    event = AuditEvent(
        user_id=user.id if user else None,
        event_type=event_type,
        ip=ip,
        user_agent=user_agent,
        metadata=metadata,
    )
    session.add(event)
    session.flush()

    if metadata and metadata.get("severity") in {"medium", "high"}:
        alert_service = alert_service or AlertService(settings)
        subject = f"SentinelAuth alert: {event_type}"
        message = metadata.get("reason", "Security event detected")
        logger.info("Triggering alert for {} severity {}", event_type, metadata.get("severity"))
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(alert_service.notify(subject, message, metadata))
        except RuntimeError:  # pragma: no cover - background tasks during sync contexts
            asyncio.run(alert_service.notify(subject, message, metadata))
