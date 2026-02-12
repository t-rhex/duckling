"""Tests for the data models used across the platform."""

from orchestrator.models.task import (
    GitProvider,
    Task,
    TaskCreate,
    TaskPriority,
    TaskSource,
    TaskStatus,
)
from orchestrator.models.vm import VM, VMBackend, VMState, WarmPoolStats


class TestTaskModel:
    def test_task_creation_defaults(self):
        task = Task(
            description="Fix the flaky test",
            repo_url="https://github.com/example-org/auth-service",
        )
        assert task.status == TaskStatus.PENDING
        assert task.priority == TaskPriority.MEDIUM
        assert task.branch == "main"
        assert task.git_provider == GitProvider.GITHUB
        assert task.id  # UUID should be auto-generated

    def test_task_mark_completed(self):
        task = Task(
            description="Fix test",
            repo_url="https://github.com/example-org/auth-service",
        )
        task.mark_completed("https://github.com/org/repo/pull/42", 42)
        assert task.status == TaskStatus.COMPLETED
        assert task.pr_url == "https://github.com/org/repo/pull/42"
        assert task.pr_number == 42
        assert task.completed_at is not None

    def test_task_mark_failed(self):
        task = Task(
            description="Fix test",
            repo_url="https://github.com/example-org/auth-service",
        )
        task.mark_failed("Timed out")
        assert task.status == TaskStatus.FAILED
        assert task.error_message == "Timed out"

    def test_task_create_validation(self):
        body = TaskCreate(
            description="Add retry logic",
            repo_url="https://github.com/example-org/payment-service",
            priority=TaskPriority.HIGH,
            labels=["bug", "agent-fix"],
        )
        assert body.priority == TaskPriority.HIGH
        assert len(body.labels) == 2


class TestVMModel:
    def test_vm_creation(self):
        vm = VM(backend=VMBackend.DOCKER)
        assert vm.state == VMState.CREATING
        assert vm.id

    def test_vm_claim_release(self):
        vm = VM(backend=VMBackend.DOCKER)
        vm.claim("task-123")
        assert vm.state == VMState.CLAIMED
        assert vm.task_id == "task-123"
        assert vm.claimed_at is not None
        vm.release()
        assert vm.state == VMState.CLEANING
        assert vm.task_id is None

    def test_warm_pool_stats(self):
        stats = WarmPoolStats(
            total_vms=10,
            ready_vms=7,
            claimed_vms=2,
            creating_vms=1,
        )
        assert stats.total_vms == 10
        assert stats.ready_vms == 7
