"""Audit endpoints."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..deps import get_db, require_any_role
from ..models import AuditEvent
from ..schemas import AuditEventOut, AuditListOut
from ..utils.time import utcnow

router = APIRouter()


@router.get("", response_model=AuditListOut, dependencies=[Depends(require_any_role("admin", "moderator"))])
def list_audit_events(
    user_id: Optional[int] = Query(None),
    event_type: Optional[str] = Query(None),
    hours: Optional[int] = Query(None, ge=1, le=720),
    db: Session = Depends(get_db),
) -> AuditListOut:
    stmt = select(AuditEvent).order_by(AuditEvent.ts.desc())
    clauses = []
    if user_id:
        clauses.append(AuditEvent.user_id == user_id)
    if event_type:
        clauses.append(AuditEvent.event_type == event_type)
    if hours:
        clauses.append(AuditEvent.ts >= utcnow() - timedelta(hours=hours))
    if clauses:
        stmt = stmt.where(and_(*clauses))
    events = db.execute(stmt).scalars().all()
    payload = [AuditEventOut.from_orm(event) for event in events]
    return AuditListOut(events=payload)
