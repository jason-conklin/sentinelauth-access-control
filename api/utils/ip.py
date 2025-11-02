"""Helpers for IP and user-agent parsing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from fastapi import Request


def client_ip(request: Request) -> str:
    """Return the best-effort client IP from headers."""
    for header in ("x-forwarded-for", "x-real-ip"):
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def user_agent(request: Request) -> str:
    """Return the user agent string."""
    return request.headers.get("user-agent", "unknown")


@dataclass
class GeoInfo:
    """Stub structure for geo lookup results."""

    country: Optional[str] = None
    city: Optional[str] = None
    asn: Optional[str] = None


def geo_lookup(ip: str) -> GeoInfo:
    """Placeholder for geo/IP lookup."""
    # Production deployments can integrate MaxMind or ipinfo.io.
    return GeoInfo()


def fingerprint(ip: str, user_agent: str, device_fingerprint: Optional[str]) -> str:
    """Return a deterministic fingerprint string."""
    parts = [ip or "unknown", user_agent or "unknown", device_fingerprint or "na"]
    return "|".join(parts)
