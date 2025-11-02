from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from api.auth.service import AuthService, RefreshPersistenceError
from api.config import get_settings
from api.deps import get_redis
from api.redis_client import close_all_cached_clients

def _get_app_from_client(client):
    app = getattr(client, "app", None)
    if app is None:
        transport = getattr(client, "_transport", None)
        app = getattr(transport, "app", None) if transport else None
    return app


def _unique_email(prefix: str = "user") -> str:
    return f"{prefix}_{uuid.uuid4().hex}@example.com"


async def _register_and_login(client: AsyncClient, email: str, password: str = "ChangeMe123!") -> dict:
    register_resp = await client.post("/auth/register", json={"email": email, "password": password})
    assert register_resp.status_code == 200
    login_resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    return login_resp.json()


@pytest.mark.asyncio
async def test_refresh_rotation_db_ok(client: AsyncClient):
    creds = await _register_and_login(client, _unique_email("rot"))
    original_refresh = creds["refresh_token"]

    refresh_resp = await client.post("/auth/refresh", json={"refresh_token": original_refresh})
    assert refresh_resp.status_code == 200
    rotated = refresh_resp.json()
    assert rotated["refresh_token"] != original_refresh
    assert "warning" not in rotated

    reuse_resp = await client.post("/auth/refresh", json={"refresh_token": original_refresh})
    assert reuse_resp.status_code == 401

    follow_up = await client.post("/auth/refresh", json={"refresh_token": rotated["refresh_token"]})
    assert follow_up.status_code == 200


@pytest.mark.asyncio
async def test_refresh_redis_miss_db_hit(client: AsyncClient):
    creds = await _register_and_login(client, _unique_email("miss"))
    refresh_token = creds["refresh_token"]

    app = _get_app_from_client(client)
    redis_instance = getattr(app.state, "test_redis", None) if app else None
    if redis_instance:
        await redis_instance.flushall()

    refresh_resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    data = refresh_resp.json()
    assert data["refresh_token"] != refresh_token


@pytest.mark.asyncio
async def test_refresh_prod_redis_down(client: AsyncClient, monkeypatch):
    settings = get_settings()
    original = (
        settings.refresh_persistence,
        settings.dev_relaxed_mode,
        settings.app_env,
    )
    settings.refresh_persistence = "redis"
    settings.dev_relaxed_mode = False
    settings.app_env = "prod"

    try:
        creds = await _register_and_login(client, _unique_email("prod"))
        refresh_token = creds["refresh_token"]

        async def _raise(url: str):
            raise RuntimeError("redis down")

        monkeypatch.setattr("api.redis_client.get_redis_client_by_url", _raise)
        await close_all_cached_clients()

        app = _get_app_from_client(client)
        original_override = None
        original_state_redis = None
        if app:
            original_override = app.dependency_overrides.get(get_redis)
            original_state_redis = getattr(app.state, "test_redis", None)
            app.dependency_overrides[get_redis] = lambda: None
            app.state.test_redis = None

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 503
        assert resp.json().get("detail") == "Service unavailable"
    finally:
        if app:
            if original_override is not None:
                app.dependency_overrides[get_redis] = original_override
            else:
                app.dependency_overrides.pop(get_redis, None)
            app.state.test_redis = original_state_redis
        settings.refresh_persistence, settings.dev_relaxed_mode, settings.app_env = original


@pytest.mark.asyncio
async def test_refresh_dev_relaxed_no_store(client: AsyncClient, monkeypatch):
    settings = get_settings()
    original = (
        settings.refresh_persistence,
        settings.dev_relaxed_mode,
    )
    settings.refresh_persistence = "redis"
    settings.dev_relaxed_mode = True

    try:
        creds = await _register_and_login(client, _unique_email("fallback"))
        refresh_token = creds["refresh_token"]

        async def _broken_issue(self, *args, **kwargs):
            raise RefreshPersistenceError("simulated store failure")

        monkeypatch.setattr(AuthService, "_issue_tokens_with_persistence", _broken_issue, raising=True)

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["access_token"]
        assert payload["refresh_token"] == refresh_token
        assert payload.get("warning") == "DEV relaxed: refresh store unavailable, rotation skipped"
    finally:
        settings.refresh_persistence, settings.dev_relaxed_mode = original
