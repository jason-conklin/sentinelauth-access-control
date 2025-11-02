"""User management routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..deps import get_current_user, get_db, require_any_role, require_roles
from ..models import User
from ..schemas import AssignRoleIn, UserListOut, UserOut, UserUpdateIn
from .service import UserService

router = APIRouter()


def _service(settings: Settings, db: Session) -> UserService:
    return UserService(settings, db)


@router.get("", response_model=UserListOut, dependencies=[Depends(require_any_role("admin", "moderator"))])
def list_users(
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> UserListOut:
    users = _service(settings, db).list_users()
    return UserListOut(users=[UserOut.from_orm(user) for user in users])


@router.get("/{user_id}", response_model=UserOut, dependencies=[Depends(require_any_role("admin", "moderator"))])
def get_user(
    user_id: int,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> UserOut:
    user = _service(settings, db).get_user(user_id)
    return UserOut.from_orm(user)


@router.post("/{user_id}/roles", response_model=UserOut, dependencies=[Depends(require_roles("admin"))])
def modify_roles(
    user_id: int,
    payload: AssignRoleIn,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> UserOut:
    user = _service(settings, db).assign_role(user_id, payload, current_user)
    return UserOut.from_orm(user)


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_roles("admin"))])
def update_user(
    user_id: int,
    payload: UserUpdateIn,
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> UserOut:
    user = _service(settings, db).update_user(user_id, payload, current_user)
    return UserOut.from_orm(user)
