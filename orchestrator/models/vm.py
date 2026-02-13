"""VM model — represents a warm-pool virtual machine."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class VMState(str, Enum):
    CREATING = "creating"
    WARMING = "warming"
    READY = "ready"
    CLAIMED = "claimed"
    RUNNING = "running"
    CLEANING = "cleaning"
    DESTROYED = "destroyed"
    ERROR = "error"


class VMBackend(str, Enum):
    FIRECRACKER = "firecracker"
    DOCKER = "docker"


class VM(BaseModel):
    """A single VM instance in the warm pool."""

    id: str = Field(default_factory=lambda: f"vm-{uuid.uuid4().hex[:12]}")
    backend: VMBackend = VMBackend.DOCKER
    state: VMState = VMState.CREATING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    claimed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    task_id: Optional[str] = None
    container_id: Optional[str] = None  # Docker container ID
    firecracker_pid: Optional[int] = None  # Firecracker process ID
    ip_address: Optional[str] = None
    ssh_port: Optional[int] = None
    repo_cached: bool = False
    memory_mb: int = 2048
    vcpu_count: int = 2
    error_message: Optional[str] = None
    secrets_dir: Optional[str] = None  # Host path to temp secrets directory

    def claim(self, task_id: str) -> None:
        self.state = VMState.CLAIMED
        self.task_id = task_id
        self.claimed_at = datetime.now(timezone.utc)

    def release(self) -> None:
        self.state = VMState.CLEANING
        self.released_at = datetime.now(timezone.utc)
        self.task_id = None


class WarmPoolStats(BaseModel):
    """Statistics for the warm pool."""

    total_vms: int = 0
    ready_vms: int = 0
    claimed_vms: int = 0
    creating_vms: int = 0
    error_vms: int = 0
    backend: VMBackend = VMBackend.DOCKER
    target_pool_size: int = 10
    avg_claim_time_ms: float = 0.0
    avg_task_duration_s: float = 0.0
