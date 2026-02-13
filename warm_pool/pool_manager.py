"""
Warm Pool Manager — maintains a pool of pre-warmed VMs for instant task execution.

Production: Firecracker microVMs with snapshot/restore (~5ms claim time)
Demo: Docker containers with pre-built images (~500ms claim time)

Architecture mirrors Stripe's approach:
1. Background loop maintains N ready VMs at all times
2. When a task arrives, a VM is "claimed" from the pool (near-instant)
3. After task completes, VM is destroyed and pool refills
"""

from __future__ import annotations

import asyncio
import time
import uuid
from abc import ABC, abstractmethod
from collections import deque
from typing import Optional

import structlog

from orchestrator.models.vm import VM, VMBackend, VMState, WarmPoolStats
from orchestrator.services.config import get_settings

logger = structlog.get_logger()


class VMBackendDriver(ABC):
    """Abstract base for VM backends (Firecracker, Docker, etc.)."""

    @abstractmethod
    async def create_vm(self, vm: VM) -> VM:
        """Spin up a new VM and return it in WARMING state."""
        ...

    @abstractmethod
    async def warm_vm(self, vm: VM, repo_url: Optional[str] = None) -> VM:
        """Pre-load repo, deps, tools — transition to READY."""
        ...

    @abstractmethod
    async def destroy_vm(self, vm: VM) -> None:
        """Tear down the VM completely."""
        ...

    @abstractmethod
    async def exec_in_vm(self, vm: VM, command: str, timeout: int = 120) -> tuple[int, str, str]:
        """Execute a command inside the VM. Returns (exit_code, stdout, stderr)."""
        ...

    @abstractmethod
    async def health_check(self, vm: VM) -> bool:
        """Check if the VM is healthy and responsive."""
        ...


class DockerBackend(VMBackendDriver):
    """Docker-based VM backend for development and demo purposes."""

    def __init__(self):
        self._docker = None

    def _get_docker(self):
        if self._docker is None:
            import docker

            self._docker = docker.from_env()
        return self._docker

    async def create_vm(self, vm: VM) -> VM:
        settings = get_settings()
        docker_client = self._get_docker()

        def _create():
            return docker_client.containers.run(
                image=settings.docker_image,
                name=f"duckling-{vm.id}",
                detach=True,
                mem_limit=f"{vm.memory_mb}m",
                cpu_count=vm.vcpu_count,
                network=settings.docker_network,
                environment={
                    "VM_ID": vm.id,
                    "ANTHROPIC_API_KEY": settings.anthropic_api_key,
                    "OPENAI_API_KEY": settings.openai_api_key,
                    "OPENAI_HOST": settings.openai_host,
                    "GOOSE_MODEL": settings.goose_model,
                    "GOOSE_PROVIDER": settings.goose_provider,
                    "OPENCODE_MODEL": settings.opencode_model,
                    "OPENCODE_ZEN_API_KEY": settings.opencode_zen_api_key,
                },
                labels={
                    "duckling.vm_id": vm.id,
                    "duckling.role": "agent-runner",
                },
                remove=False,
            )

        container = await asyncio.to_thread(_create)
        vm.container_id = container.id
        vm.state = VMState.WARMING
        await logger.ainfo("Docker container created", vm_id=vm.id, container_id=container.short_id)
        return vm

    async def warm_vm(self, vm: VM, repo_url: Optional[str] = None) -> VM:
        """Pre-install tools, clone a default repo if provided."""
        if repo_url:
            exit_code, stdout, stderr = await self.exec_in_vm(
                vm, f"git clone --depth=1 {repo_url} /workspace/repo"
            )
            if exit_code == 0:
                vm.repo_cached = True

        vm.state = VMState.READY
        await logger.ainfo("VM warmed and ready", vm_id=vm.id, repo_cached=vm.repo_cached)
        return vm

    async def destroy_vm(self, vm: VM) -> None:
        if vm.container_id:
            docker_client = self._get_docker()
            try:

                def _destroy():
                    container = docker_client.containers.get(vm.container_id)
                    container.stop(timeout=5)
                    container.remove(force=True)

                await asyncio.to_thread(_destroy)
            except Exception as e:
                await logger.awarning("Failed to destroy container", vm_id=vm.id, error=str(e))
        vm.state = VMState.DESTROYED

    async def exec_in_vm(self, vm: VM, command: str, timeout: int = 120) -> tuple[int, str, str]:
        if not vm.container_id:
            return (1, "", "No container ID")

        docker_client = self._get_docker()

        def _exec():
            container = docker_client.containers.get(vm.container_id)
            return container.exec_run(
                cmd=["bash", "-c", command],
                demux=True,
                environment={"TERM": "xterm"},
            )

        result = await asyncio.to_thread(_exec)
        stdout = result.output[0].decode() if result.output[0] else ""
        stderr = result.output[1].decode() if result.output[1] else ""
        return (result.exit_code, stdout, stderr)

    async def health_check(self, vm: VM) -> bool:
        try:
            exit_code, _, _ = await self.exec_in_vm(vm, "echo ok", timeout=5)
            return exit_code == 0
        except Exception:
            return False


class FirecrackerBackend(VMBackendDriver):
    """
    Firecracker-based VM backend for production.

    Uses snapshot/restore for ~5ms VM claim times:
    1. Create a base VM with kernel + rootfs
    2. Boot it, install all deps, clone repos
    3. Pause and snapshot the VM state
    4. On claim: restore from snapshot (instant boot)
    """

    async def create_vm(self, vm: VM) -> VM:
        settings = get_settings()
        vm.state = VMState.WARMING

        # In production, this would:
        # 1. Create a Firecracker microVM via its API socket
        # 2. Configure kernel, rootfs, network
        # 3. Boot the VM
        await logger.ainfo(
            "Firecracker VM creation (stub)",
            vm_id=vm.id,
            kernel=settings.firecracker_kernel,
        )
        return vm

    async def warm_vm(self, vm: VM, repo_url: Optional[str] = None) -> VM:
        # In production:
        # 1. SSH into VM, install Goose + deps
        # 2. Clone the default repo
        # 3. Snapshot the VM for instant restore
        vm.state = VMState.READY
        return vm

    async def destroy_vm(self, vm: VM) -> None:
        # In production: kill the Firecracker process, clean up socket + snapshot files
        vm.state = VMState.DESTROYED

    async def exec_in_vm(self, vm: VM, command: str, timeout: int = 120) -> tuple[int, str, str]:
        # In production: SSH into VM and execute
        return (0, "", "")

    async def health_check(self, vm: VM) -> bool:
        return True


class WarmPoolManager:
    """
    Manages the warm pool of pre-warmed VMs.

    Lifecycle:
        create → warm → [READY pool] → claim → run task → release → destroy
                                          ↑                          |
                                          └── refill loop ←─────────┘

    The pool maintains a target number of READY VMs. When one is claimed,
    the refill loop spins up a replacement in the background.
    """

    def __init__(self, backend: Optional[VMBackendDriver] = None):
        settings = get_settings()
        self.target_size = settings.warm_pool_size
        self.refill_threshold = settings.warm_pool_refill_threshold

        if backend:
            self.backend = backend
        elif settings.use_docker_fallback:
            self.backend = DockerBackend()
        else:
            self.backend = FirecrackerBackend()

        self._pool: deque[VM] = deque()
        self._claimed: dict[str, VM] = {}  # task_id -> VM
        self._all_vms: dict[str, VM] = {}  # vm_id -> VM
        self._lock = asyncio.Lock()
        self._refill_task: Optional[asyncio.Task] = None
        self._claim_times: deque[float] = deque(maxlen=100)
        self._running = False

    async def start(self):
        """Start the pool manager and begin pre-warming VMs."""
        self._running = True
        await logger.ainfo("Starting warm pool manager", target_size=self.target_size)
        self._refill_task = asyncio.create_task(self._refill_loop())
        # Initial fill
        await self._fill_pool()

    async def stop(self):
        """Gracefully shut down the pool."""
        self._running = False
        if self._refill_task:
            self._refill_task.cancel()

        async with self._lock:
            for vm in list(self._pool) + list(self._claimed.values()):
                try:
                    await self.backend.destroy_vm(vm)
                except Exception as e:
                    await logger.awarning("Error destroying VM during shutdown", error=str(e))

        await logger.ainfo("Warm pool manager stopped")

    async def claim_vm(self, task_id: str) -> VM:
        """
        Claim a VM from the warm pool for a task.
        This is the hot path — should complete in <10ms.
        """
        start = time.monotonic()

        async with self._lock:
            if not self._pool:
                # Emergency: no VMs available, create one on-demand
                await logger.awarning("Pool empty, creating VM on-demand", task_id=task_id)
                vm = VM(
                    backend=VMBackend.DOCKER
                    if isinstance(self.backend, DockerBackend)
                    else VMBackend.FIRECRACKER
                )
                vm = await self.backend.create_vm(vm)
                vm = await self.backend.warm_vm(vm)
            else:
                vm = self._pool.popleft()

            vm.claim(task_id)
            self._claimed[task_id] = vm
            self._all_vms[vm.id] = vm

        claim_time_ms = (time.monotonic() - start) * 1000
        self._claim_times.append(claim_time_ms)

        await logger.ainfo(
            "VM claimed",
            vm_id=vm.id,
            task_id=task_id,
            claim_time_ms=round(claim_time_ms, 2),
            pool_remaining=len(self._pool),
        )
        return vm

    async def release_vm(self, task_id: str) -> None:
        """Release a VM back after task completion — destroys and triggers refill."""
        async with self._lock:
            vm = self._claimed.pop(task_id, None)

        if vm:
            # Transition through CLEANING state so the state machine is
            # properly followed and released_at timestamp is recorded.
            vm.release()

            await self.backend.destroy_vm(vm)

            # Remove from the global registry to prevent unbounded growth
            # of _all_vms (only DESTROYED VMs are removed — CREATING/ERROR
            # VMs are still tracked for get_stats()).
            async with self._lock:
                self._all_vms.pop(vm.id, None)

            await logger.ainfo("VM released and destroyed", vm_id=vm.id, task_id=task_id)

    async def get_vm(self, task_id: str) -> Optional[VM]:
        """Get the VM assigned to a task."""
        return self._claimed.get(task_id)

    def get_stats(self) -> WarmPoolStats:
        avg_claim = sum(self._claim_times) / len(self._claim_times) if self._claim_times else 0
        return WarmPoolStats(
            total_vms=len(self._pool) + len(self._claimed),
            ready_vms=len(self._pool),
            claimed_vms=len(self._claimed),
            creating_vms=sum(1 for v in self._all_vms.values() if v.state == VMState.CREATING),
            error_vms=sum(1 for v in self._all_vms.values() if v.state == VMState.ERROR),
            backend=VMBackend.DOCKER
            if isinstance(self.backend, DockerBackend)
            else VMBackend.FIRECRACKER,
            target_pool_size=self.target_size,
            avg_claim_time_ms=round(avg_claim, 2),
        )

    async def _fill_pool(self):
        """Fill the pool up to the target size."""
        needed = self.target_size - len(self._pool)
        if needed <= 0:
            return

        await logger.ainfo("Filling warm pool", needed=needed, current=len(self._pool))
        tasks = [self._create_and_warm_vm() for _ in range(needed)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, VM):
                async with self._lock:
                    self._pool.append(result)
                    self._all_vms[result.id] = result
            elif isinstance(result, Exception):
                await logger.aerror("Failed to create VM", error=str(result))

    async def _create_and_warm_vm(self) -> VM:
        """Create a single VM and warm it up."""
        vm = VM(
            backend=VMBackend.DOCKER
            if isinstance(self.backend, DockerBackend)
            else VMBackend.FIRECRACKER
        )
        vm = await self.backend.create_vm(vm)
        vm = await self.backend.warm_vm(vm)
        return vm

    async def _refill_loop(self):
        """Background loop that keeps the pool topped up."""
        while self._running:
            try:
                if len(self._pool) < self.refill_threshold:
                    await self._fill_pool()
                await asyncio.sleep(2)
            except asyncio.CancelledError:
                break
            except Exception as e:
                await logger.aerror("Refill loop error", error=str(e))
                await asyncio.sleep(5)
