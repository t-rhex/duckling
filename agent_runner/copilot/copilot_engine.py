"""
CopilotEngine — runs the GitHub Copilot SDK locally with VM-bridging tools.

Unlike Goose (which runs inside the VM), the Copilot SDK runs on the
orchestrator and is given tools that bridge to backend.exec_in_vm()
for executing commands, reading files, and writing files inside the VM.

Supports BYOK (Bring Your Own Key) for Anthropic, OpenAI, and Azure.
"""

from __future__ import annotations

import asyncio
import json as _json

import structlog
from pydantic import BaseModel, Field

from agent_runner.engine import AgentEngine
from orchestrator.models.task import Task
from orchestrator.models.vm import VM
from orchestrator.services.config import get_settings
from warm_pool.pool_manager import VMBackendDriver

logger = structlog.get_logger()


# ── Pydantic models for tool parameters ──────────────────────────────────


class RunCommandParams(BaseModel):
    """Parameters for the run_command tool."""

    command: str = Field(description="Shell command to execute in the VM workspace")
    timeout: int = Field(default=60, description="Timeout in seconds")


class ReadFileParams(BaseModel):
    """Parameters for the read_file tool."""

    path: str = Field(description="Absolute path to the file inside the VM")


class WriteFileParams(BaseModel):
    """Parameters for the write_file tool."""

    path: str = Field(description="Absolute path to the file inside the VM")
    content: str = Field(description="File content to write")


class ListDirectoryParams(BaseModel):
    """Parameters for the list_directory tool."""

    path: str = Field(default="/workspace/repo", description="Directory path to list")


# ── Tool factory ─────────────────────────────────────────────────────────


def make_copilot_tools(backend: VMBackendDriver, vm: VM) -> list:
    """
    Create Copilot SDK tools that bridge to VM execution.

    Each tool uses @define_tool from the copilot SDK and internally
    calls backend.exec_in_vm() to execute inside the VM.
    """
    from copilot import define_tool

    @define_tool(
        description=(
            "Execute a shell command inside the workspace VM. "
            "The repo is at /workspace/repo. Use this for running commands, "
            "installing packages, searching code, running tests, etc."
        )
    )
    async def run_command(params: RunCommandParams) -> str:
        exit_code, stdout, stderr = await backend.exec_in_vm(
            vm, f"cd /workspace/repo && {params.command}", timeout=params.timeout
        )
        result = f"exit_code={exit_code}\n"
        if stdout:
            result += f"--- stdout ---\n{stdout}\n"
        if stderr:
            result += f"--- stderr ---\n{stderr}\n"
        return result

    @define_tool(
        description=(
            "Read the contents of a file in the workspace VM. "
            "Provide the absolute path (files are under /workspace/repo/)."
        )
    )
    async def read_file(params: ReadFileParams) -> str:
        exit_code, stdout, stderr = await backend.exec_in_vm(
            vm, f"cat '{params.path}'", timeout=10
        )
        if exit_code != 0:
            return f"Error reading {params.path}: {stderr}"
        return stdout

    @define_tool(
        description=(
            "Write content to a file in the workspace VM. "
            "Provide the absolute path and the full file content."
        )
    )
    async def write_file(params: WriteFileParams) -> str:
        # Use python inside the VM to write files safely (avoids shell escaping)
        escaped_content = _json.dumps(params.content)
        cmd = (
            f"python3 -c \"import json; "
            f"content = json.loads({repr(escaped_content)}); "
            f"open('{params.path}', 'w').write(content)\""
        )
        exit_code, stdout, stderr = await backend.exec_in_vm(vm, cmd, timeout=10)
        if exit_code != 0:
            return f"Error writing {params.path}: {stderr}"
        return f"Successfully wrote {params.path}"

    @define_tool(description="List files and directories in a given path inside the workspace VM.")
    async def list_directory(params: ListDirectoryParams) -> str:
        exit_code, stdout, stderr = await backend.exec_in_vm(
            vm, f"ls -la '{params.path}'", timeout=10
        )
        if exit_code != 0:
            return f"Error listing {params.path}: {stderr}"
        return stdout

    return [run_command, read_file, write_file, list_directory]


# ── CopilotEngine ────────────────────────────────────────────────────────


class CopilotEngine(AgentEngine):
    """
    Agent engine using the GitHub Copilot SDK.

    Runs the SDK locally on the orchestrator. The SDK is given tools
    (run_command, read_file, write_file, list_directory) that bridge
    to backend.exec_in_vm() for executing inside the VM.
    """

    def __init__(self):
        self._client = None
        self._session = None

    @property
    def name(self) -> str:
        return "GitHub Copilot"

    async def start(self, vm: VM, task: Task, backend: VMBackendDriver) -> None:
        from copilot import CopilotClient

        settings = get_settings()

        # Create and start the client
        self._client = CopilotClient()
        await self._client.start()

        # Build tools that bridge SDK calls → VM execution
        tools = make_copilot_tools(backend, vm)

        # Build session config
        session_config: dict = {
            "model": settings.copilot_model,
            "tools": tools,
        }

        # BYOK: if a provider is configured, use it
        if settings.copilot_provider_type:
            provider_config: dict = {"type": settings.copilot_provider_type}
            if settings.copilot_provider_type == "anthropic":
                provider_config["api_key"] = settings.anthropic_api_key
            elif settings.copilot_provider_type == "openai":
                provider_config["api_key"] = settings.copilot_openai_api_key
            session_config["provider"] = provider_config

        self._session = await self._client.create_session(session_config)

        await logger.ainfo(
            "Copilot SDK session started",
            model=settings.copilot_model,
            provider=settings.copilot_provider_type or "default",
            tools_count=len(tools),
        )

    async def execute_prompt(self, prompt: str, timeout: int = 180) -> tuple[bool, str]:
        if not self._session:
            return (False, "Copilot session not started")

        done = asyncio.Event()
        response_parts: list[str] = []
        error_occurred = False

        def on_event(event):
            nonlocal error_occurred
            event_type = event.type.value if hasattr(event.type, "value") else str(event.type)

            if event_type == "assistant.message":
                response_parts.append(event.data.content)
            elif event_type == "assistant.message_delta":
                # Streaming deltas — accumulate
                delta = getattr(event.data, "delta_content", "")
                if delta:
                    response_parts.append(delta)
            elif event_type == "error":
                msg = getattr(event.data, "message", str(event.data))
                response_parts.append(f"Error: {msg}")
                error_occurred = True
                done.set()
            elif event_type == "session.idle":
                done.set()

        self._session.on(on_event)

        try:
            await self._session.send({"prompt": prompt})
            await asyncio.wait_for(done.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            return (False, f"Copilot SDK timed out after {timeout}s")

        output = "".join(response_parts)
        return (not error_occurred, output)

    async def stop(self) -> None:
        if self._session:
            try:
                await self._session.destroy()
            except Exception:
                pass
            self._session = None

        if self._client:
            try:
                await self._client.stop()
            except Exception:
                pass
            self._client = None
