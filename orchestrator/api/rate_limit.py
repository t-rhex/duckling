"""Simple in-memory rate limiting for the Duckling API."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        """Raise 429 if the key has exceeded the rate limit."""
        now = time.monotonic()
        window = self._buckets[key]

        # Evict old entries
        self._buckets[key] = [t for t in window if now - t < 60]

        if len(self._buckets[key]) >= self.rpm:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Try again later.",
            )
        self._buckets[key].append(now)


_limiter = RateLimiter(requests_per_minute=60)


async def rate_limit(request: Request) -> None:
    """FastAPI dependency that enforces rate limiting per client IP."""
    client_ip = request.client.host if request.client else "unknown"
    _limiter.check(client_ip)
