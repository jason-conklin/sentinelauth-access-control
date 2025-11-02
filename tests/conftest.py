from __future__ import annotations

import os
from pathlib import Path
import sys
import gc
import time
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


# Ensure imports work when tests are launched via PowerShell (repo root not auto-added).
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-123456")
os.environ.setdefault("ACCESS_TOKEN_TTL_MIN", "15")
os.environ.setdefault("REFRESH_TOKEN_TTL_DAYS", "7")
os.environ.setdefault("API_PORT", "8001")
os.environ.setdefault("DB_URL", "sqlite:///./sentinelauth_test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("REFRESH_PERSISTENCE", "db")

from api.main import create_app  # noqa: E402
from api.config import get_settings  # noqa: E402
from api.db import Base, get_engine, get_session_factory  # noqa: E402
from api.deps import get_redis  # noqa: E402
from api import redis_client as redis_module  # noqa: E402


try:
    import fakeredis.aioredis as fakeredis
except ImportError:  # pragma: no cover
    fakeredis = None  # type: ignore


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    db_path = Path("sentinelauth_test.db")
    if db_path.exists():
        db_path.unlink()
    settings = get_settings()
    engine = get_engine(settings)
    Base.metadata.create_all(bind=engine)
    yield
    try:
        engine.dispose()
    except Exception:
        pass

    for _ in range(5):
        try:
            if db_path.exists():
                db_path.unlink()
            break
        except PermissionError:
            gc.collect()
            time.sleep(0.2)
@pytest.fixture(autouse=True)
def clean_database():
    settings = get_settings()
    session_factory = get_session_factory(settings)
    session = session_factory()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    finally:
        session.close()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    settings = get_settings()
    redis_module._clients.clear()
    redis_module._last_url = settings.redis_url

    app = create_app()
    fake = fakeredis.FakeRedis() if fakeredis else None
    if fake:
        redis_module._clients[settings.redis_url] = fake
        redis_module._last_url = settings.redis_url
        await fake.flushall()
        app.state.test_redis = fake
    else:
        app.state.test_redis = None

    async def _override_redis():
        if fake:
            return fake
        from redis.asyncio import Redis

        return Redis.from_url(os.environ["REDIS_URL"])

    app.dependency_overrides[get_redis] = _override_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client

    if fake:
        await fake.flushall()
