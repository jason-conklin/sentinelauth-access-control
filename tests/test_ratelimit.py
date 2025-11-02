from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_login_rate_limit(client):
    last_status = None
    for _ in range(6):
        resp = await client.post(
            "/auth/login",
            json={"email": "rate@example.com", "password": "WrongPass123!"},
        )
        last_status = resp.status_code
    assert last_status == 429
