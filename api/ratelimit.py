"""Redis-backed token bucket rate limiting."""

from __future__ import annotations

import time
from typing import Tuple

from fastapi import HTTPException, status
from loguru import logger
from redis.asyncio import Redis

from .config import Settings
from .redis_client import get_redis_client_by_url

RATE_LIMIT_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "timestamp")
local tokens = tonumber(data[1])
local timestamp = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    timestamp = now
else
    local delta = now - timestamp
    local refill = delta * refill_rate
    tokens = math.min(capacity, tokens + refill)
end

if tokens < 1 then
    redis.call("HMSET", key, "tokens", tokens, "timestamp", now)
    redis.call("EXPIRE", key, ttl)
    return {0, tokens}
else
    tokens = tokens - 1
    redis.call("HMSET", key, "tokens", tokens, "timestamp", now)
    redis.call("EXPIRE", key, ttl)
    return {1, tokens}
end
"""


class RateLimitExceeded(HTTPException):
    """Exception representing a rate limit breach."""

    def __init__(self, detail: str = "Too many requests"):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)


async def consume_token(
    redis: Redis,
    key: str,
    capacity: int,
    period_seconds: int,
) -> Tuple[bool, float]:
    """Consume a token from the bucket. Returns success flag and remaining tokens."""
    now = time.time()
    refill_rate = capacity / period_seconds
    ttl = max(period_seconds * 2, 1)
    response = await redis.eval(
        RATE_LIMIT_LUA,
        keys=[key],
        args=[str(capacity), f"{refill_rate}", f"{now}", str(ttl)],
    )
    success = int(response[0])
    remaining = float(response[1])
    return bool(success), remaining


async def rate_limit_or_raise(
    settings: Settings,
    redis: Redis | None,
    key: str,
    capacity: int,
    period_seconds: int,
    detail: str,
) -> None:
    """Enforce a rate limit, raising HTTP 429 on breach."""
    if redis is None:
        try:
            redis = await get_redis_client_by_url(settings.redis_url)
        except Exception as exc:
            redis = None
            logger.warning("Failed to obtain Redis client for rate limit {}: {}", key, exc)
    if redis is None:
        message = f"Skipping rate limit for {key}; Redis unavailable"
        if settings.dev_relaxed_mode:
            logger.warning(message)
            return
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis unavailable")
    try:
        ok, remaining = await consume_token(redis, key, capacity, period_seconds)
    except Exception as exc:
        logger.warning("Rate limiter error for key {}: {}", key, exc)
        if settings.dev_relaxed_mode:
            return
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Redis unavailable") from exc
    if not ok:
        logger.warning("Rate limit hit for key={} remaining={}", key, remaining)
        raise RateLimitExceeded(detail=detail)
