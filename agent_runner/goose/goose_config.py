"""
Goose Agent Configuration — generates the config files Goose needs to run.

Goose (by Block) uses a profile-based configuration system.
We generate a custom profile for each task that includes:
1. The MCP tools the agent can use (codebase search, Jira, CI, etc.)
2. The model configuration (Claude, GPT-4, etc.)
3. Task-specific instructions and constraints
"""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from orchestrator.services.config import get_settings

logger = structlog.get_logger()


def generate_goose_profile(
    task_description: str,
    repo_path: str = "/workspace/repo",
    task_id: str = "",
    extra_tools: list[dict] = None,
) -> dict:
    """
    Generate a Goose profile configuration for a task.

    This profile tells Goose:
    - Which model to use
    - What MCP tools are available
    - How to approach the task
    - Safety constraints and guardrails
    """
    settings = get_settings()

    provider = settings.goose_provider

    profile = {
        "provider": provider,
        "model": settings.goose_model,
        "processor": settings.goose_model,
        "accelerator": settings.goose_model,
        "instructions": f"""You are an autonomous coding agent working on a software engineering task.
Your goal is to make minimal, focused changes to fix the issue described below.

TASK: {task_description}

WORKSPACE: {repo_path}

RULES:
1. Read the codebase first to understand the architecture and patterns
2. Make the smallest change that fixes the issue
3. Follow existing code style and conventions
4. Add or update tests for your changes
5. Run tests to verify your fix works
6. Do NOT modify files unrelated to the task
7. Do NOT add unnecessary dependencies
8. Do NOT refactor code unless directly related to the fix
9. Write clear, descriptive commit messages

WORKFLOW:
1. Explore the project structure
2. Identify the root cause
3. Plan your fix
4. Implement the fix
5. Run linting: ruff check --fix . && ruff format .
6. Run tests: python -m pytest -v
7. If tests fail, analyze and fix
8. Repeat until all tests pass
""",
        "mcpServers": {
            "duckling-tools": {
                "command": "python",
                "args": ["-m", "mcp_toolshed.server"],
                "env": {
                    "WORKSPACE": repo_path,
                    "TASK_ID": task_id,
                },
            }
        },
        "toolConstraints": {
            # Goose permission model — which tools are allowed
            "allow": [
                "read_file",
                "write_file",
                "list_directory",
                "search_files",
                "execute_command",
                "codebase_search",
                "run_tests",
                "run_linter",
            ],
            "deny": [
                "delete_file",  # Safety: no file deletion
                "network_request",  # Safety: no network access
            ],
        },
    }

    if extra_tools:
        for tool in extra_tools:
            profile["mcpServers"][tool["name"]] = tool["config"]

    return profile


def write_goose_config(profile: dict, config_dir: str = "/workspace/.goose") -> str:
    """Write the Goose configuration files to disk."""
    os.makedirs(config_dir, exist_ok=True)

    # Write the profile
    profile_path = os.path.join(config_dir, "profiles.yaml")
    config_path = os.path.join(config_dir, "config.yaml")

    # Goose uses YAML for config
    import yaml

    with open(profile_path, "w") as f:
        yaml.dump({"default": profile}, f, default_flow_style=False)

    # Write the main config pointing to the profile
    main_config = {
        "default_profile": "default",
        "GOOSE_PROVIDER__TYPE": profile.get("provider", "openai"),
        "GOOSE_PROVIDER__MODEL": profile.get("model", "deepseek/deepseek-chat-v3-0324"),
    }

    with open(config_path, "w") as f:
        yaml.dump(main_config, f, default_flow_style=False)

    return config_dir


def generate_goose_session_command(
    task_description: str,
    repo_path: str = "/workspace/repo",
) -> list[str]:
    """
    Generate the shell command to launch a Goose session.

    Returns the command as a list of args for subprocess.
    """
    return [
        "goose",
        "session",
        "start",
        "--profile",
        "default",
        "--text",
        task_description,
        "--dir",
        repo_path,
    ]
