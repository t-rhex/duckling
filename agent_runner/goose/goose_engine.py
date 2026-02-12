"""
GooseEngine — runs Goose inside the VM via shell commands.

This wraps the existing Goose invocation pattern: the agent runs entirely
inside the VM, invoked via `goose run <message_file>` shell commands.
Goose's `run` subcommand accepts a path to a markdown file containing
the prompt (it does NOT accept a `-m` flag).
"""

from __future__ import annotations

import shlex

from agent_runner.engine import AgentEngine
from orchestrator.models.task import Task
from orchestrator.models.vm import VM
from orchestrator.services.config import get_settings
from warm_pool.pool_manager import VMBackendDriver


class GooseEngine(AgentEngine):
    """Executes prompts by writing a markdown file and running `goose run <file>`."""

    def __init__(self):
        self._backend: VMBackendDriver | None = None
        self._vm: VM | None = None
        self._prompt_counter: int = 0
        self._env_prefix: str = ""

    @property
    def name(self) -> str:
        return "Goose"

    def _build_env_prefix(self) -> str:
        """Build shell env var exports for the goose process."""
        settings = get_settings()
        env_vars = {}

        if settings.goose_provider == "openai":
            env_vars["OPENAI_API_KEY"] = settings.openai_api_key
            env_vars["OPENAI_HOST"] = settings.openai_host
        elif settings.goose_provider == "anthropic":
            env_vars["ANTHROPIC_API_KEY"] = settings.anthropic_api_key

        if not env_vars:
            return ""

        parts = [f"export {k}={shlex.quote(v)}" for k, v in env_vars.items() if v]
        return " && ".join(parts) + " && " if parts else ""

    async def start(self, vm: VM, task: Task, backend: VMBackendDriver) -> None:
        self._backend = backend
        self._vm = vm
        self._prompt_counter = 0
        self._env_prefix = self._build_env_prefix()

        settings = get_settings()
        provider = settings.goose_provider
        model = settings.goose_model

        # Generate the correct profiles.yaml using goose's own profile factory
        # inside the VM so the YAML structure is guaranteed to be valid.
        gen_profile_script = (
            f"python3 -c \""
            f"from goose.cli.config import default_profiles, PROFILES_CONFIG_PATH;"
            f"import os, yaml;"
            f"profiles = default_profiles();"
            f"factory = profiles.get('default');"
            f"profile = factory('{provider}', '{model}', '{model}');"
            f"os.makedirs(str(PROFILES_CONFIG_PATH.parent), exist_ok=True);"
            f"PROFILES_CONFIG_PATH.write_text(yaml.dump({{'default': profile.to_dict()}}, default_flow_style=False))"
            f"\""
        )

        # Patch goose's OpenAI provider to use proper Bearer token auth
        # instead of HTTP Basic Auth (which OpenRouter rejects).
        openai_provider_path = (
            "/usr/local/lib/python3.12/site-packages/exchange/providers/openai.py"
        )
        patch_cmd = (
            f"sed -i 's/auth=(\"Bearer\", key)/headers={{\"Authorization\": f\"Bearer {{key}}\"}}/g' "
            f"{openai_provider_path}"
        )

        setup_cmds = " && ".join([
            "mkdir -p /workspace/prompts",
            "pip3 install -q pyyaml 2>/dev/null || true",
            gen_profile_script,
            patch_cmd,
        ])
        await self._backend.exec_in_vm(vm, setup_cmds, timeout=30)

    async def execute_prompt(self, prompt: str, timeout: int = 180) -> tuple[bool, str]:
        if not self._backend or not self._vm:
            return (False, "GooseEngine not started")

        self._prompt_counter += 1
        prompt_file = f"/workspace/prompts/step_{self._prompt_counter}.md"

        # Write the prompt to a markdown file inside the VM using heredoc
        write_cmd = f"cat > {prompt_file} << 'GOOSE_PROMPT_EOF'\n{prompt}\nGOOSE_PROMPT_EOF"
        exit_code, _, stderr = await self._backend.exec_in_vm(
            self._vm, write_cmd, timeout=5,
        )
        if exit_code != 0:
            return (False, f"Failed to write prompt file: {stderr}")

        # Run goose with env vars and the message file
        run_cmd = f"{self._env_prefix}cd /workspace/repo && goose run {shlex.quote(prompt_file)}"
        exit_code, stdout, stderr = await self._backend.exec_in_vm(
            self._vm,
            run_cmd,
            timeout=timeout,
        )
        output = stdout if exit_code == 0 else f"{stdout}\n{stderr}"
        return (exit_code == 0, output)

    async def stop(self) -> None:
        self._backend = None
        self._vm = None
