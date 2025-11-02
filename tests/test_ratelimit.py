from __future__ import annotations

import pytest
from api.ratelimit import reset_memory_rate_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limit_between_tests():
    reset_memory_rate_limiter()
    yield
    reset_memory_rate_limiter()


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

