"""
MCP Toolshed — the set of internal tools available to the Goose agent.

Mirrors Stripe's approach where agents have access to:
- Codebase search (semantic + grep)
- Jira/issue tracker integration
- CI pipeline triggers
- Internal documentation lookup
- Slack notifications

Each tool is defined as an MCP-compatible tool that Goose can invoke.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

import structlog

logger = structlog.get_logger()


@dataclass
class ToolDefinition:
    """MCP-compatible tool definition."""

    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable


class MCPToolshed:
    """
    Registry and executor for MCP tools.

    Tools are registered with their schemas and handlers,
    then made available to the Goose agent via the MCP protocol.
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._register_builtin_tools()

    def register(self, name: str, description: str, parameters: dict, handler: Callable):
        """Register a new tool."""
        self._tools[name] = ToolDefinition(
            name=name,
            description=description,
            parameters=parameters,
            handler=handler,
        )

    def get_tool_schemas(self) -> list[dict]:
        """Get MCP-compatible tool schemas for all registered tools."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": {
                    "type": "object",
                    "properties": tool.parameters,
                },
            }
            for tool in self._tools.values()
        ]

    async def execute(self, tool_name: str, arguments: dict) -> dict:
        """Execute a tool by name with given arguments."""
        tool = self._tools.get(tool_name)
        if not tool:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            result = await tool.handler(**arguments)
            return {"result": result}
        except Exception as e:
            await logger.aerror("Tool execution failed", tool=tool_name, error=str(e))
            return {"error": str(e)}

    def generate_goose_config(self) -> dict:
        """Generate a Goose-compatible MCP tools configuration."""
        return {
            "mcpServers": {
                "duckling-toolshed": {
                    "command": "python",
                    "args": ["-m", "mcp_toolshed.server"],
                    "tools": self.get_tool_schemas(),
                }
            }
        }

    def _register_builtin_tools(self):
        """Register the default set of internal tools."""

        # ── Codebase Search ────────────────────────────────────────
        self.register(
            name="codebase_search",
            description="Search the codebase using ripgrep for pattern matching. Returns matching files and lines.",
            parameters={
                "pattern": {"type": "string", "description": "Regex pattern to search for"},
                "path": {"type": "string", "description": "Directory to search in", "default": "."},
                "file_type": {
                    "type": "string",
                    "description": "File extension filter (e.g., 'py', 'js')",
                },
            },
            handler=self._search_codebase,
        )

        # ── File Reader ────────────────────────────────────────────
        self.register(
            name="read_file",
            description="Read the contents of a file in the repo.",
            parameters={
                "path": {"type": "string", "description": "Path to the file relative to repo root"},
            },
            handler=self._read_file,
        )

        # ── Test Runner ────────────────────────────────────────────
        self.register(
            name="run_tests",
            description="Run the test suite or specific test files.",
            parameters={
                "test_path": {"type": "string", "description": "Specific test file or directory"},
                "verbose": {
                    "type": "boolean",
                    "description": "Show verbose output",
                    "default": True,
                },
            },
            handler=self._run_tests,
        )

        # ── Linter ─────────────────────────────────────────────────
        self.register(
            name="run_linter",
            description="Run the linter (ruff) and return results.",
            parameters={
                "fix": {"type": "boolean", "description": "Auto-fix issues", "default": True},
            },
            handler=self._run_linter,
        )

        # ── Jira Integration ──────────────────────────────────────
        self.register(
            name="jira_get_issue",
            description="Fetch details of a Jira issue by key (e.g., PROJ-123).",
            parameters={
                "issue_key": {"type": "string", "description": "Jira issue key"},
            },
            handler=self._jira_get_issue,
        )

        # ── Jira Comment ──────────────────────────────────────────
        self.register(
            name="jira_add_comment",
            description="Add a comment to a Jira issue.",
            parameters={
                "issue_key": {"type": "string", "description": "Jira issue key"},
                "comment": {"type": "string", "description": "Comment text"},
            },
            handler=self._jira_add_comment,
        )

        # ── CI Trigger ────────────────────────────────────────────
        self.register(
            name="trigger_ci",
            description="Trigger a CI pipeline run for a branch.",
            parameters={
                "branch": {"type": "string", "description": "Branch name"},
                "pipeline": {
                    "type": "string",
                    "description": "Pipeline name",
                    "default": "default",
                },
            },
            handler=self._trigger_ci,
        )

        # ── Slack Notify ──────────────────────────────────────────
        self.register(
            name="slack_notify",
            description="Send a status notification to a Slack channel.",
            parameters={
                "channel": {"type": "string", "description": "Slack channel ID"},
                "message": {"type": "string", "description": "Message to send"},
            },
            handler=self._slack_notify,
        )

    # ── Tool handlers ─────────────────────────────────────────────

    async def _search_codebase(self, pattern: str, path: str = ".", file_type: str = None) -> str:
        import subprocess

        cmd = ["rg", "--json", "-n", pattern, path]
        if file_type:
            cmd.extend(["-t", file_type])
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30, cwd="/workspace/repo"
            )
            return result.stdout[:5000]
        except Exception as e:
            return f"Search error: {e}"

    async def _read_file(self, path: str) -> str:
        try:
            with open(f"/workspace/repo/{path}") as f:
                return f.read()[:10000]
        except Exception as e:
            return f"Read error: {e}"

    async def _run_tests(self, test_path: str = "", verbose: bool = True) -> str:
        import subprocess

        cmd = ["python", "-m", "pytest"]
        if test_path:
            cmd.append(test_path)
        if verbose:
            cmd.append("-v")
        cmd.extend(["--tb=short", "-q"])
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=120, cwd="/workspace/repo"
            )
            return result.stdout + result.stderr
        except Exception as e:
            return f"Test error: {e}"

    async def _run_linter(self, fix: bool = True) -> str:
        import subprocess

        cmd = ["ruff", "check"]
        if fix:
            cmd.append("--fix")
        cmd.append(".")
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30, cwd="/workspace/repo"
            )
            return result.stdout + result.stderr
        except Exception as e:
            return f"Lint error: {e}"

    async def _jira_get_issue(self, issue_key: str) -> str:
        # Stub — in production, use atlassian-python-api
        return json.dumps(
            {
                "key": issue_key,
                "summary": f"Issue {issue_key}",
                "status": "In Progress",
                "description": "Placeholder — connect to real Jira instance",
            }
        )

    async def _jira_add_comment(self, issue_key: str, comment: str) -> str:
        return json.dumps({"status": "comment_added", "issue": issue_key})

    async def _trigger_ci(self, branch: str, pipeline: str = "default") -> str:
        return json.dumps({"status": "triggered", "branch": branch, "pipeline": pipeline})

    async def _slack_notify(self, channel: str, message: str) -> str:
        return json.dumps({"status": "sent", "channel": channel})
