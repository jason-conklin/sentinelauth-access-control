from __future__ import annotations

import pytest

from api.config import get_settings
from api.db import get_session_factory
from api.models import AuditEvent


@pytest.mark.asyncio
async def test_audit_records_created(client):
    await client.post("/auth/register", json={"email": "audit@example.com", "password": "ChangeMe123!"})
    await client.post(
        "/auth/login",
        json={"email": "audit@example.com", "password": "ChangeMe123!"},
    )

    settings = get_settings()
    session = get_session_factory(settings)()
    try:
        events = session.query(AuditEvent).filter(AuditEvent.event_type.in_(["user.register", "user.login"])).all()
        assert len(events) >= 2
    finally:
        session.close()
