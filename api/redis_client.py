from typing import Dict, Optional

from redis import asyncio as aioredis

_clients: Dict[str, aioredis.Redis] = {}
_last_url: Optional[str] = None


async def _safe_close(client: aioredis.Redis) -> None:
    try:
        await client.aclose()
    except Exception:
        pass


async def get_redis_client_by_url(url: str) -> Optional[aioredis.Redis]:
    if not url:
        return None

    global _last_url
    _last_url = url

    client = _clients.get(url)
    if client is not None:
        try:
            await client.ping()
            return client
        except Exception:
            await _safe_close(client)
            _clients.pop(url, None)

    client = aioredis.from_url(url, encoding="utf-8", decode_responses=True)
    try:
        await client.ping()
    except Exception:
        await _safe_close(client)
        raise
    _clients[url] = client
    return client


async def _ensure_client(url: Optional[str] = None, client: Optional[aioredis.Redis] = None) -> aioredis.Redis:
    if client is not None:
        return client
    target_url = url or _last_url
    if not target_url:
        raise RuntimeError("Redis URL is not configured.")
    client = await get_redis_client_by_url(target_url)
    if client is None:
        raise RuntimeError("Redis client unavailable.")
    return client


async def cache_refresh_jti(
    jti: str,
    user_id: int,
    ttl_seconds: int,
    url: Optional[str] = None,
    client: Optional[aioredis.Redis] = None,
) -> None:
    client = await _ensure_client(url, client)
    await client.setex(f"refresh:{jti}", ttl_seconds, str(user_id))


async def is_refresh_jti_valid(
    jti: str,
    url: Optional[str] = None,
    client: Optional[aioredis.Redis] = None,
) -> bool:
    client = await _ensure_client(url, client)
    exists = await client.exists(f"refresh:{jti}")
    return bool(exists)


async def delete_refresh_jti(
    jti: str,
    url: Optional[str] = None,
    client: Optional[aioredis.Redis] = None,
) -> None:
    client = await _ensure_client(url, client)
    await client.delete(f"refresh:{jti}")


async def close_cached_client(url: str) -> None:
    client = _clients.pop(url, None)
    if client:
        await _safe_close(client)
    global _last_url
    if _last_url == url:
        _last_url = None


async def close_all_cached_clients() -> None:
    for url in list(_clients.keys()):
        await close_cached_client(url)
