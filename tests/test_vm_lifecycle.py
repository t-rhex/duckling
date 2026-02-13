"""Tests for VM lifecycle gap fixes.

Covers:
1. TaskQueue.cancel_task() cancels the asyncio task (GAP 1)
2. WarmPoolManager.release_vm() removes VM from _all_vms (GAP 2)
3. WarmPoolManager.release_vm() calls vm.release() before destroy (GAP 3)
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from orchestrator.models.task import Task, TaskStatus
from orchestrator.models.vm import VM, VMBackend, VMState


# ---------------------------------------------------------------------------
# Helpers — lightweight fakes that don't need Docker or Firecracker
# ---------------------------------------------------------------------------


class FakeBackend:
    """A backend that records calls instead of touching containers."""

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


def _make_pool(backend=None, target_size=2):
    """Create a WarmPoolManager with sensible test defaults."""
    from warm_pool.pool_manager import WarmPoolManager

    with patch("warm_pool.pool_manager.get_settings") as mock_settings:
        settings = MagicMock()
        settings.warm_pool_size = target_size
        settings.warm_pool_refill_threshold = 1
        settings.use_docker_fallback = True
        settings.docker_image = "test:latest"
        settings.docker_network = "bridge"
        settings.anthropic_api_key = ""
        settings.openai_api_key = ""
        settings.openai_host = ""
        settings.goose_model = ""
        settings.goose_provider = ""
        settings.opencode_model = ""
        settings.opencode_zen_api_key = ""
        mock_settings.return_value = settings
        pool = WarmPoolManager(backend=backend or FakeBackend())
    return pool


# ---------------------------------------------------------------------------
# GAP 1: TaskQueue.cancel_task() must cancel the asyncio task
# ---------------------------------------------------------------------------


class TestCancelTask:
    """Verify that cancel_task cancels the asyncio task and marks status."""

    @pytest.mark.asyncio
    async def test_cancel_task_sets_cancelled_status(self):
        """cancel_task should set task.status = CANCELLED."""
        from orchestrator.services.pipeline import TaskPipeline, TaskQueue

        pipeline = MagicMock(spec=TaskPipeline)
        queue = TaskQueue(pipeline=pipeline, max_concurrent=5)

        task = Task(
            description="test task",
            repo_url="https://github.com/test/repo",
        )
        queue._tasks[task.id] = task
        task.status = TaskStatus.RUNNING

        result = await queue.cancel_task(task.id)
        assert result is True
        assert task.status == TaskStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_cancel_task_cancels_asyncio_task(self):
        """cancel_task should call .cancel() on the active asyncio.Task."""
        from orchestrator.services.pipeline import TaskPipeline, TaskQueue

        pipeline = MagicMock(spec=TaskPipeline)
        queue = TaskQueue(pipeline=pipeline, max_concurrent=5)

        task = Task(
            description="test task",
            repo_url="https://github.com/test/repo",
        )
        queue._tasks[task.id] = task
        task.status = TaskStatus.RUNNING

        # Simulate an active asyncio task
        mock_async_task = MagicMock()
        mock_async_task.done.return_value = False
        mock_async_task.cancel = MagicMock()
        queue._active[task.id] = mock_async_task

        await queue.cancel_task(task.id)
        mock_async_task.cancel.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_task_returns_false_for_unknown(self):
        """cancel_task should return False for unknown task IDs."""
        from orchestrator.services.pipeline import TaskPipeline, TaskQueue

        pipeline = MagicMock(spec=TaskPipeline)
        queue = TaskQueue(pipeline=pipeline, max_concurrent=5)

        result = await queue.cancel_task("nonexistent-id")
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_task_skips_already_done(self):
        """cancel_task should not call .cancel() if the asyncio task is already done."""
        from orchestrator.services.pipeline import TaskPipeline, TaskQueue

        pipeline = MagicMock(spec=TaskPipeline)
        queue = TaskQueue(pipeline=pipeline, max_concurrent=5)

        task = Task(
            description="test task",
            repo_url="https://github.com/test/repo",
        )
        queue._tasks[task.id] = task
        task.status = TaskStatus.RUNNING

        mock_async_task = MagicMock()
        mock_async_task.done.return_value = True
        mock_async_task.cancel = MagicMock()
        queue._active[task.id] = mock_async_task

        await queue.cancel_task(task.id)
        mock_async_task.cancel.assert_not_called()
        assert task.status == TaskStatus.CANCELLED


# ---------------------------------------------------------------------------
# GAP 2: release_vm() must remove VM from _all_vms
# ---------------------------------------------------------------------------


class TestReleaseVmMemoryLeak:
    """Verify that _all_vms does not grow unboundedly."""

    @pytest.mark.asyncio
    async def test_release_vm_removes_from_all_vms(self):
        """After release_vm, the VM should be gone from _all_vms."""
        backend = FakeBackend()
        pool = _make_pool(backend=backend)

        # Manually add a VM to simulate claim_vm
        vm = VM(backend=VMBackend.DOCKER)
        vm.state = VMState.CLAIMED
        vm.task_id = "task-abc"
        pool._claimed["task-abc"] = vm
        pool._all_vms[vm.id] = vm

        assert vm.id in pool._all_vms

        await pool.release_vm("task-abc")

        assert vm.id not in pool._all_vms
        assert "task-abc" not in pool._claimed
        assert len(backend.destroyed) == 1

    @pytest.mark.asyncio
    async def test_release_vm_noop_for_unknown_task(self):
        """release_vm with an unknown task_id should not raise."""
        pool = _make_pool()
        # Should not raise
        await pool.release_vm("nonexistent-task-id")

    @pytest.mark.asyncio
    async def test_all_vms_stable_after_many_cycles(self):
        """Simulate many claim/release cycles and verify _all_vms stays bounded."""
        backend = FakeBackend()
        pool = _make_pool(backend=backend, target_size=1)

        for i in range(20):
            task_id = f"task-{i}"
            vm = VM(backend=VMBackend.DOCKER)
            vm.state = VMState.CLAIMED
            vm.task_id = task_id
            pool._claimed[task_id] = vm
            pool._all_vms[vm.id] = vm

            await pool.release_vm(task_id)

        # After 20 cycles, _all_vms should be empty (all destroyed and removed)
        assert len(pool._all_vms) == 0
        assert len(pool._claimed) == 0
        assert len(backend.destroyed) == 20


# ---------------------------------------------------------------------------
# GAP 3: release_vm() must call vm.release() before destroy
# ---------------------------------------------------------------------------


class TestReleaseVmStateTransition:
    """Verify that vm.release() is called, setting state to CLEANING and recording released_at."""

    @pytest.mark.asyncio
    async def test_release_vm_calls_vm_release(self):
        """The VM should transition through CLEANING before DESTROYED."""
        backend = FakeBackend()
        pool = _make_pool(backend=backend)

        vm = VM(backend=VMBackend.DOCKER)
        vm.claim("task-xyz")
        assert vm.state == VMState.CLAIMED
        assert vm.released_at is None

        pool._claimed["task-xyz"] = vm
        pool._all_vms[vm.id] = vm

        await pool.release_vm("task-xyz")

        # vm.release() should have been called (sets released_at)
        assert vm.released_at is not None
        # Final state after backend.destroy_vm is DESTROYED
        assert vm.state == VMState.DESTROYED

    @pytest.mark.asyncio
    async def test_release_vm_clears_task_id(self):
        """vm.release() should clear the task_id."""
        backend = FakeBackend()
        pool = _make_pool(backend=backend)

        vm = VM(backend=VMBackend.DOCKER)
        vm.claim("task-clear")
        pool._claimed["task-clear"] = vm
        pool._all_vms[vm.id] = vm

        await pool.release_vm("task-clear")

        # vm.release() sets task_id = None
        assert vm.task_id is None
