from __future__ import annotations

import pytest

from api.config import get_settings
from api.db import get_session_factory
from api.models import Role, User
from api.security import hash_password


def _ensure_admin():
    settings = get_settings()
    session = get_session_factory(settings)()
    try:
        admin = session.query(User).filter(User.email == "admin@example.com").one_or_none()
        if not admin:
            admin_role = session.query(Role).filter(Role.name == "admin").one_or_none()
            if not admin_role:
                admin_role = Role(name="admin")
                session.add(admin_role)
                session.flush()
            admin = User(
                email="admin@example.com",
                password_hash=hash_password("AdminPass123!"),
                is_active=True,
            )
            admin.roles.append(admin_role)
            session.add(admin)
            session.commit()
    finally:
        session.close()


@pytest.mark.asyncio
async def test_rbac_enforcement(client):
    await client.post("/auth/register", json={"email": "user@example.com", "password": "ChangeMe123!"})
    login_resp = await client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "ChangeMe123!"},
    )
    user_tokens = login_resp.json()
    me_resp = await client.get(
        "/users",
        headers={"Authorization": f"Bearer {user_tokens['access_token']}"},
    )
    assert me_resp.status_code == 403

    _ensure_admin()
    admin_login = await client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    admin_tokens = admin_login.json()

    users_resp = await client.get(
        "/users",
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert users_resp.status_code == 200
    payload = users_resp.json()
    assert "users" in payload
