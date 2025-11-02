from __future__ import annotations

import pytest

@pytest.mark.asyncio
async def test_full_auth_flow(client):
    register_resp = await client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "ChangeMe123!"},
    )
    assert register_resp.status_code == 200
    tokens = register_resp.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    me_resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "alice@example.com"

    refresh_resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    refreshed = refresh_resp.json()
    assert refreshed["refresh_token"] != refresh_token
    new_refresh = refreshed["refresh_token"]

    reuse_resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_resp.status_code == 401

    logout_resp = await client.post(
        "/auth/logout",
        json={"refresh_token": new_refresh},
        headers={"Authorization": f"Bearer {refreshed['access_token']}"},
    )
    assert logout_resp.status_code == 200

    post_logout_resp = await client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert post_logout_resp.status_code == 401
