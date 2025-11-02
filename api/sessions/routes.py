"""Session administration routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit.service import record_event
from ..config import Settings, get_settings
from ..deps import get_current_user, get_db, require_roles
from ..models import Session as SessionModel, User
from ..schemas import SessionListOut, SessionOut
from ..utils.time import utcnow

router = APIRouter()


@router.get("", response_model=SessionListOut, dependencies=[Depends(require_roles("admin"))])
def list_sessions(
    db: Session = Depends(get_db),
) -> SessionListOut:
    sessions = (
        db.execute(
            select(SessionModel).order_by(SessionModel.created_at.desc())
        )
        .scalars()
        .all()
    )
    return SessionListOut(sessions=sessions)


@router.post("/{session_id}/revoke", response_model=SessionOut, dependencies=[Depends(require_roles("admin"))])
def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> SessionOut:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.active = False
    session.last_seen_at = utcnow()

    record_event(
        db,
        settings,
        "session.revoke",
        current_user,
        ip=None,
        user_agent=None,
        metadata={"session_id": session_id, "target_user": session.user_id},
    )
    db.commit()
    return SessionOut.from_orm(session)
