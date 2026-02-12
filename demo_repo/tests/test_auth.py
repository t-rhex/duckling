"""
Tests for the auth service — includes intentionally flaky tests.

These tests demonstrate the kinds of issues a coding agent should fix:
1. Race condition in rate limiter (test_rate_limiter_concurrent)
2. Flaky test due to timing (test_session_expiry)
3. Missing response body assertion (test_logout)
"""

import asyncio
import time
import threading
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, _users, _sessions
from app.rate_limiter import RateLimiter, TokenBucket


@pytest.fixture(autouse=True)
def clean_state():
    """Reset in-memory state between tests."""
    _users.clear()
    _sessions.clear()
    yield
    _users.clear()
    _sessions.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def registered_user(client):
    """Register a test user and return the response data."""
    resp = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "securepass123",
            "name": "Test User",
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def logged_in_user(client, registered_user):
    """Register + login a user, return (user_data, session_data)."""
    resp = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "securepass123",
        },
    )
    assert resp.status_code == 200
    return registered_user, resp.json()


# ── Registration tests ────────────────────────────────────────────


class TestRegistration:
    def test_register_success(self, client):
        resp = client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "password": "securepass123",
                "name": "New User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@example.com"
        assert data["name"] == "New User"
        assert "id" in data

    def test_register_duplicate_email(self, client, registered_user):
        resp = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "anotherpass123",
                "name": "Duplicate User",
            },
        )
        assert resp.status_code == 409

    def test_register_short_password(self, client):
        resp = client.post(
            "/auth/register",
            json={
                "email": "short@example.com",
                "password": "short",
                "name": "Short Pass",
            },
        )
        assert resp.status_code == 422  # Validation error


# ── Login tests ───────────────────────────────────────────────────


class TestLogin:
    def test_login_success(self, client, registered_user):
        resp = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "securepass123",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_token" in data
        assert "expires_at" in data
        assert data["user_id"] == registered_user["id"]

    def test_login_wrong_password(self, client, registered_user):
        resp = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword",
            },
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "somepassword",
            },
        )
        assert resp.status_code == 401


# ── Session tests ─────────────────────────────────────────────────


class TestSession:
    def test_get_current_user(self, client, logged_in_user):
        user_data, session_data = logged_in_user
        resp = client.get(f"/auth/me?token={session_data['session_token']}")
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    def test_invalid_token(self, client):
        resp = client.get("/auth/me?token=invalid-token-123")
        assert resp.status_code == 401

    def test_refresh_token(self, client, logged_in_user):
        _, session_data = logged_in_user
        resp = client.post(
            "/auth/refresh",
            json={
                "session_token": session_data["session_token"],
            },
        )
        assert resp.status_code == 200
        new_data = resp.json()
        assert new_data["session_token"] != session_data["session_token"]

    # FLAKY TEST: This test is timing-dependent and occasionally fails
    # because the session expiry comparison in validate_session() is buggy
    def test_session_expiry(self, client, registered_user):
        """Test that expired sessions are rejected."""
        # Login to get a session
        resp = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "securepass123",
            },
        )
        session = resp.json()
        token = session["session_token"]

        # Manually expire the session by backdating expires_at
        from datetime import datetime, timedelta, timezone

        _sessions[token]["expires_at"] = (
            datetime.now(timezone.utc) - timedelta(hours=1)
        ).isoformat()

        # This should fail because the session is expired
        resp = client.get(f"/auth/me?token={token}")
        assert resp.status_code == 401, f"Expected 401 for expired session, got {resp.status_code}"


# ── Logout tests ──────────────────────────────────────────────────


class TestLogout:
    def test_logout_success(self, client, logged_in_user):
        _, session_data = logged_in_user
        token = session_data["session_token"]

        resp = client.delete(f"/auth/logout?token={token}")
        assert resp.status_code == 200

        # BUG: The response body is null because logout() doesn't return anything
        # This assertion will fail:
        data = resp.json()
        assert data is not None, "Logout should return a response body"
        assert data.get("status") == "logged_out"

    def test_logout_invalid_token(self, client):
        resp = client.delete("/auth/logout?token=fake-token")
        assert resp.status_code == 200  # Should succeed silently


# ── Rate limiter tests ────────────────────────────────────────────


class TestRateLimiter:
    def test_basic_rate_limiting(self):
        limiter = RateLimiter(requests_per_second=2.0, burst=2.0)
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is True
        # Third request should be rate limited
        assert limiter.is_allowed("192.168.1.1") is False

    def test_different_clients_independent(self):
        limiter = RateLimiter(requests_per_second=1.0, burst=1.0)
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.2") is True  # Different client
        assert limiter.is_allowed("192.168.1.1") is False  # Same client, rate limited

    # FLAKY TEST: Race condition in TokenBucket causes this to fail intermittently
    def test_rate_limiter_concurrent(self):
        """Test that the rate limiter handles concurrent requests correctly."""
        bucket = TokenBucket(rate=0.0, capacity=5.0)  # No refill
        results = []

        def make_request():
            result = bucket.consume("test-key")
            results.append(result)

        # Fire 10 concurrent requests with only 5 tokens available
        threads = [threading.Thread(target=make_request) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Exactly 5 should succeed, 5 should fail
        # BUG: Due to the race condition, more than 5 might succeed
        successes = sum(1 for r in results if r is True)
        failures = sum(1 for r in results if r is False)

        assert successes == 5, f"Expected exactly 5 successes, got {successes}"
        assert failures == 5, f"Expected exactly 5 failures, got {failures}"

    def test_retry_after(self):
        limiter = RateLimiter(requests_per_second=1.0, burst=1.0)
        limiter.is_allowed("192.168.1.1")  # Consume the one token
        retry_after = limiter.get_retry_after("192.168.1.1")
        assert retry_after >= 0.0


# ── Health check ──────────────────────────────────────────────────


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "users_count" in data
        assert "active_sessions" in data
