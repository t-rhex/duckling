"""Shared test fixtures for the Duckling test suite."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from orchestrator.models.task import Task, TaskPriority, TaskStatus
from orchestrator.models.vm import VM, VMBackend, VMState


class FakeBackend:
    """A VM backend that records calls instead of touching containers."""

    def __init__(self):
        self.created: list[VM] = []
        self.warmed: list[VM] = []
        self.destroyed: list[VM] = []

    async def create_vm(self, vm: VM) -> VM:
        vm.state = VMState.WARMING
        self.created.append(vm)
        return vm

    async def warm_vm(self, vm, repo_url=None):
        vm.state = VMState.READY
        self.warmed.append(vm)
        return vm

    async def destroy_vm(self, vm: VM) -> None:
        vm.state = VMState.DESTROYED
        self.destroyed.append(vm)

    async def exec_in_vm(self, vm, command, timeout=120):
        return (0, "", "")

    async def health_check(self, vm):
        return True


@pytest.fixture
def fake_backend():
    """Return a fresh FakeBackend instance."""
    return FakeBackend()


@pytest.fixture
def sample_task():
    """Return a sample Task with sensible defaults."""
    return Task(
        description="Fix the flaky test in the auth service module",
        repo_url="https://github.com/example-org/auth-service",
    )


@pytest.fixture
def sample_vm():
    """Return a sample VM in READY state."""
    vm = VM(backend=VMBackend.DOCKER)
    vm.state = VMState.READY
    return vm


@pytest.fixture
def mock_settings():
    """Patch get_settings() across the orchestrator and return the mock settings object."""
    with patch("orchestrator.services.config.get_settings") as mock:
        settings = MagicMock()
        settings.warm_pool_size = 2
        settings.warm_pool_refill_threshold = 1
        settings.use_docker_fallback = True
        settings.docker_image = "test:latest"
        settings.docker_network = "bridge"
        settings.agent_backend = "opencode"
        settings.anthropic_api_key = ""
        settings.openai_api_key = ""
        settings.openai_host = ""
        settings.goose_model = ""
        settings.goose_provider = ""
        settings.opencode_model = ""
        settings.opencode_zen_api_key = ""
        settings.github_token = ""
        settings.api_key = ""
        settings.secret_key = "test-secret"
        settings.env = "development"
        settings.is_production = False
        settings.slack_bot_token = ""
        settings.slack_signing_secret = ""
        settings.slack_app_token = ""
        settings.bitbucket_username = ""
        settings.bitbucket_app_password = ""
        settings.bitbucket_workspace = ""
        settings.validate_production_settings.return_value = []
        settings.validate_required_keys.return_value = []
        mock.return_value = settings
        yield settings
