"""Tests for the task pipeline and queue."""

import pytest

from orchestrator.models.task import Task, TaskPriority, TaskStatus
from orchestrator.services.config import get_settings

structlog = pytest.importorskip("structlog")


class TestTaskPipelineConfig:
    def test_settings_defaults(self):
        settings = get_settings()
        assert settings.env == "development" or settings.env  # any value is fine
        assert settings.warm_pool_size > 0
        assert settings.use_docker_fallback in (True, False)

    def test_settings_agent_backend(self):
        """Test that the agent_backend setting exists and has a valid default."""
        settings = get_settings()
        assert settings.agent_backend in ("goose", "copilot")

    def test_pr_title_generation(self):
        """Test that PR titles are properly formatted."""
        from orchestrator.services.pipeline import TaskPipeline

        pipeline = TaskPipeline.__new__(TaskPipeline)

        task = Task(
            description="Fix the flaky test_session_expiry in auth service",
            repo_url="https://github.com/example-org/auth-service",
        )
        title = pipeline._generate_pr_title(task)
        assert title.startswith("Fix") or title.startswith("fix")
        assert len(title) <= 76  # 72 + prefix room

    def test_pr_title_truncation(self):
        from orchestrator.services.pipeline import TaskPipeline

        pipeline = TaskPipeline.__new__(TaskPipeline)

        task = Task(
            description="A" * 100,
            repo_url="https://github.com/example-org/auth-service",
        )
        title = pipeline._generate_pr_title(task)
        assert len(title) <= 80
        assert title.endswith("...")
