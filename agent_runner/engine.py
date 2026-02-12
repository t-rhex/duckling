"""
AgentEngine ABC — pluggable AI backend for the runner's creative steps.

The runner's 8-step loop has two kinds of steps:
    - Deterministic (setup, lint, test, commit) — agent-agnostic, always use exec_in_vm
    - Creative (analyze, plan, code, repair)    — delegated to the AgentEngine

This module defines the contract and provides a factory function.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from orchestrator.models.task import Task
from orchestrator.models.vm import VM
from warm_pool.pool_manager import VMBackendDriver


class AgentEngine(ABC):
    """
    Abstract base for AI agent engines (Goose, GitHub Copilot SDK, etc.).

    Lifecycle:
        create → start(vm, task, backend) → execute_prompt() × N → stop()
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable engine name for logs and commit messages."""
        ...

    @abstractmethod
    async def start(self, vm: VM, task: Task, backend: VMBackendDriver) -> None:
        """
        Initialize the engine for a task run.

        For Goose: writes config files into the VM.
        For Copilot: starts the SDK client, creates a session with tools.
        """
        ...

    @abstractmethod
    async def execute_prompt(self, prompt: str, timeout: int = 180) -> tuple[bool, str]:
        """
        Send a prompt to the AI agent and wait for completion.

        Returns (success: bool, output: str).
        """
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Tear down the engine (destroy sessions, stop clients)."""
        ...


def create_engine(engine_name: str) -> AgentEngine:
    """Factory function to create the appropriate engine."""
    if engine_name == "goose":
        from agent_runner.goose.goose_engine import GooseEngine

        return GooseEngine()
    elif engine_name == "copilot":
        from agent_runner.copilot.copilot_engine import CopilotEngine

        return CopilotEngine()
    else:
        raise ValueError(f"Unknown agent engine: {engine_name!r}. Use 'goose' or 'copilot'.")
