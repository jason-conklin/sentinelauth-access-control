"""User management service."""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit.service import record_event
from ..config import Settings
from ..models import Role, User
from ..schemas import AssignRoleIn, UserUpdateIn
from ..security import hash_password


class UserService:
    def __init__(self, settings: Settings, db: Session):
        self.settings = settings
        self.db = db

    def list_users(self) -> List[User]:
        return list(self.db.execute(select(User)).scalars().all())

    def get_user(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def assign_role(self, user_id: int, payload: AssignRoleIn, actor: User) -> User:
        user = self.get_user(user_id)
        role = self._get_or_create_role(payload.role)

        if payload.action == "add":
            if role not in user.roles:
                user.roles.append(role)
        else:
            if role in user.roles:
                user.roles.remove(role)

        record_event(
            self.db,
            self.settings,
            "user.role.update",
            actor,
            ip=None,
            user_agent=None,
            metadata={"target_user": user.email, "role": payload.role, "action": payload.action},
        )
        self.db.commit()
        return user

    def update_user(self, user_id: int, payload: UserUpdateIn, actor: User) -> User:
        user = self.get_user(user_id)
        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.password:
            user.password_hash = hash_password(payload.password)

        record_event(
            self.db,
            self.settings,
            "user.update",
            actor,
            ip=None,
            user_agent=None,
            metadata={"target_user": user.email, "changed": payload.dict(exclude_none=True)},
        )
        self.db.commit()
        return user

    def _get_or_create_role(self, name: str) -> Role:
        role = self.db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
        if not role:
            role = Role(name=name)
            self.db.add(role)
            self.db.flush()
        return role
