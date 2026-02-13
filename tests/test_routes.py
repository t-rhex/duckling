"""Tests for the REST API routes (L5).

Covers:
- Health endpoint
- Task CRUD endpoints (validation, 404 handling)
- Authentication bypass in dev mode (no API key configured)

These tests use FastAPI's TestClient which runs synchronously.
The lifespan hook requires Docker / external services, so we
construct the app but override the dependencies where needed.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Guard against missing test dependencies
fastapi = pytest.importorskip("fastapi")
httpx = pytest.importorskip("httpx")


def _make_test_client():
    """Create a TestClient with the task queue / pool manager mocked out.

    We bypass the full lifespan (which tries to start Docker containers)
    by constructing the app and injecting fake dependencies directly.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from orchestrator.api.routes import router, set_dependencies

    # Build a minimal app without the real lifespan
    app = FastAPI()
    app.include_router(router)

    # Inject fake dependencies so endpoints don't return 503
    mock_queue = AsyncMock()
    mock_queue.list_tasks = AsyncMock(return_value=([], 0))
    mock_queue.get_task = AsyncMock(return_value=None)
    mock_queue.submit = AsyncMock()
    mock_queue.cancel_task = AsyncMock(return_value=False)

    mock_pool = MagicMock()
    mock_pool.get_stats = AsyncMock(
        return_value=MagicMock(
            total_vms=0,
            ready_vms=0,
            claimed_vms=0,
            creating_vms=0,
            error_vms=0,
            backend="docker",
            target_pool_size=2,
            avg_claim_time_ms=0.0,
            avg_task_duration_s=0.0,
            model_dump=MagicMock(
                return_value={
                    "total_vms": 0,
                    "ready_vms": 0,
                    "claimed_vms": 0,
                    "creating_vms": 0,
                    "error_vms": 0,
                    "backend": "docker",
                    "target_pool_size": 2,
                    "avg_claim_time_ms": 0.0,
                    "avg_task_duration_s": 0.0,
                }
            ),
        )
    )

    set_dependencies(mock_queue, mock_pool)

    client = TestClient(app, raise_server_exceptions=False)
    return client, mock_queue, mock_pool


class TestHealthEndpoint:
    """Tests for GET /api/health."""

    @patch("orchestrator.services.config.get_settings")
    def test_health_check_returns_200(self, mock_settings):
        settings = MagicMock()
        settings.api_key = ""  # dev mode — no auth
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/health")
        assert response.status_code == 200

    @patch("orchestrator.services.config.get_settings")
    def test_health_check_includes_status(self, mock_settings):
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "healthy"

    @patch("orchestrator.services.config.get_settings")
    def test_health_check_includes_queue_connected(self, mock_settings):
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/health")
        data = response.json()
        assert "queue_connected" in data
        assert data["queue_connected"] is True


class TestTaskEndpoints:
    """Tests for task CRUD endpoints."""

    @patch("orchestrator.services.config.get_settings")
    def test_create_task_requires_description(self, mock_settings):
        """POST /api/tasks with empty body should return 422."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.post("/api/tasks", json={})
        assert response.status_code == 422

    @patch("orchestrator.services.config.get_settings")
    def test_create_task_requires_repo_url(self, mock_settings):
        """POST /api/tasks with description but no repo_url should return 422."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.post(
            "/api/tasks",
            json={"description": "Fix the flaky test in the auth service module"},
        )
        assert response.status_code == 422

    @patch("orchestrator.services.config.get_settings")
    def test_create_task_validates_description_min_length(self, mock_settings):
        """Description must be at least 20 chars."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.post(
            "/api/tasks",
            json={
                "description": "too short",
                "repo_url": "https://github.com/org/repo",
            },
        )
        assert response.status_code == 422

    @patch("orchestrator.services.config.get_settings")
    def test_create_task_validates_repo_url_format(self, mock_settings):
        """repo_url must be a valid GitHub or Bitbucket HTTPS URL."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.post(
            "/api/tasks",
            json={
                "description": "Fix the flaky test in the auth service module",
                "repo_url": "not-a-valid-url",
            },
        )
        assert response.status_code == 422

    @patch("orchestrator.services.config.get_settings")
    def test_list_tasks_returns_paginated(self, mock_settings):
        """GET /api/tasks should return a paginated list."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert data["tasks"] == []
        assert data["total"] == 0

    @patch("orchestrator.services.config.get_settings")
    def test_get_nonexistent_task_returns_404(self, mock_settings):
        """GET /api/tasks/{id} should return 404 for unknown task."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/tasks/nonexistent-id")
        assert response.status_code == 404

    @patch("orchestrator.services.config.get_settings")
    def test_cancel_nonexistent_task_returns_404(self, mock_settings):
        """DELETE /api/tasks/{id} should return 404 for unknown task."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.delete("/api/tasks/nonexistent-id")
        assert response.status_code == 404

    @patch("orchestrator.services.config.get_settings")
    def test_get_task_log_nonexistent_returns_404(self, mock_settings):
        """GET /api/tasks/{id}/log should return 404 for unknown task."""
        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/tasks/nonexistent-id/log")
        assert response.status_code == 404


class TestTaskEndpointsWithNoQueue:
    """Tests that endpoints handle a missing task queue gracefully."""

    @patch("orchestrator.services.config.get_settings")
    def test_list_tasks_returns_503_when_no_queue(self, mock_settings):
        """GET /api/tasks returns 503 if the task queue isn't initialized."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from orchestrator.api.routes import router, set_dependencies

        settings = MagicMock()
        settings.api_key = ""
        mock_settings.return_value = settings

        app = FastAPI()
        app.include_router(router)
        set_dependencies(None, None)  # No queue, no pool

        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/tasks")
        assert response.status_code == 503


class TestAuthBypass:
    """When DUCKLING_API_KEY is empty, auth should be skipped (dev mode)."""

    @patch("orchestrator.services.config.get_settings")
    def test_no_api_key_allows_access(self, mock_settings):
        settings = MagicMock()
        settings.api_key = ""  # Dev mode
        mock_settings.return_value = settings

        client, _, _ = _make_test_client()
        response = client.get("/api/tasks")
        assert response.status_code == 200
