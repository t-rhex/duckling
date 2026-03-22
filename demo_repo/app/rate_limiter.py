"""
Rate limiter middleware — has a subtle concurrency bug that causes flaky tests.

The bug: the token bucket implementation doesn't properly handle concurrent
requests, leading to race conditions where the count can go negative.
This is the kind of real-world bug that a coding agent should be able to fix.
"""

from __future__ import annotations

import time
from collections import defaultdict


class TokenBucket:
    """
    Token bucket rate limiter.

    BUG: This implementation has a race condition in concurrent scenarios.
    The `consume` method reads and writes `tokens` non-atomically,
    which means two concurrent requests can both see tokens > 0
    and both consume, driving the count below zero.

    The agent should fix this by adding proper locking.
    """

    def __init__(self, rate: float = 10.0, capacity: float = 10.0):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self._buckets: dict[str, dict] = defaultdict(
            lambda: {"tokens": capacity, "last_refill": time.monotonic()}
        )

    def consume(self, key: str, tokens: float = 1.0) -> bool:
        """
        Try to consume tokens from the bucket for the given key.
        Returns True if the request is allowed, False if rate limited.
        """
        bucket = self._buckets[key]

        # Refill tokens based on elapsed time
        now = time.monotonic()
        elapsed = now - bucket["last_refill"]
        bucket["tokens"] = min(self.capacity, bucket["tokens"] + elapsed * self.rate)
        bucket["last_refill"] = now

        # BUG: No lock here — concurrent reads can both see tokens > 0
        if bucket["tokens"] >= tokens:
            bucket["tokens"] -= tokens
            return True

        return False

    def get_remaining(self, key: str) -> float:
        """Get the remaining tokens for a key."""
        bucket = self._buckets[key]
        now = time.monotonic()
        elapsed = now - bucket["last_refill"]
        return min(self.capacity, bucket["tokens"] + elapsed * self.rate)

    def reset(self, key: str) -> None:
        """Reset the bucket for a key."""
        if key in self._buckets:
            del self._buckets[key]


class RateLimiter:
    """Application-level rate limiter wrapping TokenBucket."""

    def __init__(self, requests_per_second: float = 10.0, burst: float = 20.0):
        self.bucket = TokenBucket(rate=requests_per_second, capacity=burst)

    def is_allowed(self, client_ip: str) -> bool:
        """Check if a request from the given IP is allowed."""
        return self.bucket.consume(client_ip)

    def get_retry_after(self, client_ip: str) -> float:
        """Get the seconds until the next request will be allowed."""
        remaining = self.bucket.get_remaining(client_ip)
        if remaining >= 1.0:
            return 0.0
        return (1.0 - remaining) / self.bucket.rate
