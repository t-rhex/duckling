"""
OpenCodeEngine — runs OpenCode inside the VM as an HTTP server, controlled via REST API.

Unlike Goose (which shells out per-prompt), OpenCode runs as a persistent server
inside the container. The engine communicates with it via httpx HTTP calls from
the orchestrator. This gives us:
  - Structured JSON output (json_schema validation)
  - Session management (conversation context preserved across steps)
  - 75+ model support via OpenCode's provider system
  - Free model access via OpenCode Zen (big-pickle, kimi-k2.5-free, etc.)
"""

from __future__ import annotations

import asyncio
import json

import httpx
import structlog

from agent_runner.engine import AgentEngine
from orchestrator.models.task import Task
from orchestrator.models.vm import VM
from orchestrator.services.config import get_settings
from warm_pool.pool_manager import VMBackendDriver

logger = structlog.get_logger()

# How long to wait for the OpenCode server to become healthy inside the container
_SERVER_START_TIMEOUT = 30  # seconds
_SERVER_HEALTH_POLL_INTERVAL = 0.5  # seconds
_OPENCODE_PORT = 4096


class OpenCodeEngine(AgentEngine):
    """
    Executes prompts by running an OpenCode server inside the VM and
    controlling it via its REST API from the orchestrator.

    Lifecycle:
        start()  → launch `opencode serve` in container, wait for health, create session
        execute_prompt() → POST /session/{id}/message, wait for response
        stop()   → abort session, cleanup
    """

    def __init__(self):
        self._backend: VMBackendDriver | None = None
        self._vm: VM | None = None
        self._client: httpx.AsyncClient | None = None
        self._session_id: str | None = None
        self._base_url: str = ""

    @property
    def name(self) -> str:
        return "OpenCode"

    async def start(self, vm: VM, task: Task, backend: VMBackendDriver) -> None:
        self._backend = backend
        self._vm = vm
        settings = get_settings()

        # Build env var exports for the OpenCode server process
        env_exports = self._build_env_exports(settings)

        # Write the opencode.json config into the workspace
        opencode_config = self._build_config(settings)
        config_json = json.dumps(opencode_config)
        await backend.exec_in_vm(
            vm,
            f"mkdir -p /workspace/repo && cat > /workspace/opencode.json << 'OPENCODE_CFG_EOF'\n{config_json}\nOPENCODE_CFG_EOF",
            timeout=5,
        )

        # Start the OpenCode server in the background
        # The server listens on 0.0.0.0:4096 inside the container.
        # We use nohup + disown to ensure it survives the exec session ending.
        start_cmd = (
            f"{env_exports}"
            f"cd /workspace && "
            f"nohup opencode serve "
            f"--port {_OPENCODE_PORT} "
            f"--hostname 0.0.0.0 "
            f"> /workspace/opencode-server.log 2>&1 &"
        )
        await backend.exec_in_vm(vm, start_cmd, timeout=10)
        await logger.ainfo(
            "OpenCode server starting",
            vm_id=vm.id,
            port=_OPENCODE_PORT,
        )

        # Discover the container's IP on the Docker network
        container_ip = await self._get_container_ip(vm, backend)
        self._base_url = f"http://{container_ip}:{_OPENCODE_PORT}"

        # Wait for the server to become healthy
        await self._wait_for_health()

        # Create an httpx client for the session
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(600.0, connect=10.0),
        )

        # Create a session
        self._session_id = await self._create_session(task.id)
        await logger.ainfo(
            "OpenCode session created",
            vm_id=vm.id,
            session_id=self._session_id,
        )

    async def execute_prompt(self, prompt: str, timeout: int = 180) -> tuple[bool, str]:
        if not self._client or not self._session_id:
            return (False, "OpenCodeEngine not started")

        try:
            response = await self._client.post(
                f"/session/{self._session_id}/message",
                json={
                    "parts": [{"type": "text", "text": prompt}],
                },
                timeout=httpx.Timeout(float(timeout), connect=10.0),
            )

            if response.status_code != 200:
                error_text = response.text[:500]
                await logger.awarning(
                    "OpenCode prompt failed",
                    status=response.status_code,
                    error=error_text,
                    content_type=response.headers.get("content-type", ""),
                )
                return (False, f"HTTP {response.status_code}: {error_text}")

            # Check content-type — OpenCode SPA may return HTML for unknown routes
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type:
                await logger.awarning(
                    "OpenCode returned HTML instead of JSON (endpoint may not exist)",
                    session_id=self._session_id,
                    content_type=content_type,
                )
                return (False, "OpenCode returned HTML — message endpoint not found")

            # Handle empty response body
            body = response.text
            if not body or not body.strip():
                await logger.awarning(
                    "OpenCode returned empty response body",
                    session_id=self._session_id,
                    status=response.status_code,
                    content_type=content_type,
                    headers=dict(response.headers),
                )
                return (False, "Empty response from OpenCode")

            data = response.json()

            # Check for LLM-level errors (status 200 but info.error present)
            info = data.get("info", {})
            if info.get("error"):
                error_data = info["error"]
                error_name = error_data.get("name", "UnknownError")
                error_msg = error_data.get("data", {}).get("message", str(error_data))
                await logger.awarning(
                    "OpenCode LLM error",
                    session_id=self._session_id,
                    error_name=error_name,
                    error_message=error_msg[:200],
                )
                return (False, f"LLM error ({error_name}): {error_msg[:500]}")

            output = self._extract_output(data)
            return (True, output)

        except httpx.TimeoutException:
            await logger.awarning(
                "OpenCode prompt timed out",
                session_id=self._session_id,
                timeout=timeout,
            )
            return (False, f"Prompt timed out after {timeout}s")
        except Exception as e:
            await logger.aerror(
                "OpenCode prompt error",
                session_id=self._session_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            return (False, f"Error: {e}")

    async def execute_prompt_structured(
        self, prompt: str, schema: dict, timeout: int = 180
    ) -> tuple[bool, str, dict | None]:
        """
        Send a prompt and request structured JSON output validated against a schema.

        Returns (success, raw_output, parsed_json_or_none).
        This is used by the review pipeline for structured report generation.
        """
        if not self._client or not self._session_id:
            return (False, "OpenCodeEngine not started", None)

        try:
            response = await self._client.post(
                f"/session/{self._session_id}/message",
                json={
                    "parts": [{"type": "text", "text": prompt}],
                    "format": {
                        "type": "json_schema",
                        "schema": schema,
                        "retryCount": 2,
                    },
                },
                timeout=httpx.Timeout(float(timeout), connect=10.0),
            )

            if response.status_code != 200:
                return (False, f"HTTP {response.status_code}: {response.text[:500]}", None)

            data = response.json()
            output = self._extract_output(data)

            # Extract structured output if available
            structured = None
            info = data.get("info", {})
            if info.get("structured_output"):
                structured = info["structured_output"]

            return (True, output, structured)

        except Exception as e:
            return (False, f"Error: {e}", None)

    async def stop(self) -> None:
        if self._client and self._session_id:
            try:
                await self._client.post(f"/session/{self._session_id}/abort")
            except Exception:
                pass  # Best-effort abort

        if self._client:
            await self._client.aclose()

        self._client = None
        self._session_id = None
        self._backend = None
        self._vm = None

    # ── Private helpers ──────────────────────────────────────────────

    @staticmethod
    def _read_secret_shell(name: str) -> str:
        """Return a shell snippet that reads a secret from /run/secrets/.

        This is used to build export statements that read keys from
        mounted secret files instead of embedding them as literals in
        shell commands.  The files are mounted read-only into the
        container by the pool manager.
        """
        return f"$(cat /run/secrets/{name} 2>/dev/null)"

    def _build_env_exports(self, settings) -> str:
        """Build shell export statements for the OpenCode server process.

        Secrets are read from /run/secrets/ files (mounted by the pool
        manager) rather than from container environment variables.  This
        prevents API keys from being visible via ``env`` / ``printenv``.

        NOTE: We only pass provider-native API keys. The OpenRouter key
        (OPENAI_API_KEY with openrouter.ai host) should NOT be passed as
        OPENAI_API_KEY because OpenCode sends it to api.openai.com, not
        OpenRouter. OpenCode's free Zen models work without any API key.
        """
        parts: list[str] = []

        # Only pass the OpenAI key if it's an actual OpenAI key (not OpenRouter).
        # Check the host from the secrets file or settings to determine.
        openai_key = settings.openai_api_key or ""
        openai_host = getattr(settings, "openai_host", "") or ""
        is_openrouter = "openrouter" in openai_host.lower() or openai_key.startswith("sk-or-")
        if openai_key and not is_openrouter:
            parts.append(f"export OPENAI_API_KEY={self._read_secret_shell('openai_api_key')}")
        elif is_openrouter:
            parts.append("unset OPENAI_API_KEY")  # Prevent OpenCode using it

        if settings.anthropic_api_key:
            parts.append(f"export ANTHROPIC_API_KEY={self._read_secret_shell('anthropic_api_key')}")

        # OpenCode Zen API key (for free/paid Zen models)
        opencode_zen_key = getattr(settings, "opencode_zen_api_key", "")
        if opencode_zen_key:
            parts.append(
                f"export OPENCODE_API_KEY={self._read_secret_shell('opencode_zen_api_key')}"
            )

        if not parts:
            return ""
        return " && ".join(parts) + " && "

    def _build_config(self, settings) -> dict:
        """Build the opencode.json configuration for the container.

        Model resolution priority:
        1. OPENCODE_MODEL env var (explicit user choice)
        2. Default: opencode/big-pickle (free, no API key needed)

        We do NOT fall back to GOOSE_MODEL because Goose model IDs
        (e.g. deepseek/deepseek-chat-v3-0324) are OpenRouter-specific
        and not valid OpenCode model IDs.
        """
        model = getattr(settings, "opencode_model", "") or "opencode/big-pickle"

        config = {
            "$schema": "https://opencode.ai/config.json",
            "permission": "allow",
            "model": model,
        }

        return config

    async def _get_container_ip(self, vm: VM, backend: VMBackendDriver) -> str:
        """Get the container's IP address on the Docker network."""
        # Use docker inspect to get the container IP
        exit_code, stdout, stderr = await backend.exec_in_vm(
            vm,
            "hostname -i",
            timeout=5,
        )
        if exit_code == 0 and stdout.strip():
            ip = stdout.strip().split()[0]
            await logger.ainfo("Container IP discovered", vm_id=vm.id, ip=ip)
            return ip

        # Fallback: use container name (Docker DNS on bridge network)
        container_name = f"duckling-{vm.id}"
        await logger.ainfo(
            "Falling back to container name for discovery",
            vm_id=vm.id,
            name=container_name,
        )
        return container_name

    async def _wait_for_health(self) -> None:
        """Poll the OpenCode server's health endpoint until it responds."""
        loop = asyncio.get_running_loop()
        deadline = loop.time() + _SERVER_START_TIMEOUT
        last_error = ""

        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            while asyncio.get_running_loop().time() < deadline:
                try:
                    resp = await client.get(f"{self._base_url}/global/health")
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("healthy") or data.get("data", {}).get("healthy"):
                            await logger.ainfo("OpenCode server healthy", url=self._base_url)
                            return
                except (httpx.ConnectError, httpx.ConnectTimeout) as e:
                    last_error = str(e)
                except Exception as e:
                    last_error = str(e)

                await asyncio.sleep(_SERVER_HEALTH_POLL_INTERVAL)

        raise RuntimeError(
            f"OpenCode server did not become healthy within {_SERVER_START_TIMEOUT}s. "
            f"Last error: {last_error}"
        )

    async def _create_session(self, task_id: str) -> str:
        """Create a new OpenCode session and return its ID."""
        if self._client is None:
            raise RuntimeError("OpenCode client not initialized — call start() first")

        response = await self._client.post(
            "/session",
            json={"title": f"duckling-{task_id[:8]}"},
        )
        response.raise_for_status()
        data = response.json()

        # The response format may vary — try common shapes
        session_id = (
            data.get("id") or data.get("data", {}).get("id") or data.get("session", {}).get("id")
        )
        if not session_id:
            raise RuntimeError(f"Failed to extract session ID from response: {data}")

        return session_id

    def _extract_output(self, data: dict) -> str:
        """Extract the text output from an OpenCode message response.

        Actual response shape from `POST /session/{id}/message`:
        {
            "info": { "id": "msg_...", "role": "assistant", ... },
            "parts": [
                { "type": "step-start", ... },
                { "type": "reasoning", "text": "..." },
                { "type": "text", "text": "the actual answer" },
                { "type": "tool-invocation", "toolName": "...", ... },
                { "type": "step-finish", ... }
            ]
        }
        """
        parts = data.get("parts", [])
        if parts:
            texts = []
            for part in parts:
                if part.get("type") == "text":
                    texts.append(part.get("text", ""))
                elif part.get("type") == "tool-invocation":
                    tool_name = part.get("toolName", "")
                    result = part.get("result", "")
                    if result:
                        texts.append(f"[{tool_name}]: {result}")
            if texts:
                return "\n".join(texts)

        # Fallback: check for content in info
        content = data.get("info", {}).get("content", "")
        if content:
            return content

        # Last resort: return the full JSON as string
        return json.dumps(data, indent=2)
