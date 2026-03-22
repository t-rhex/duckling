"""
MCP Server — serves the Duckling Toolshed tools via the Model Context Protocol.

This is the entry point that Goose calls to discover and invoke tools.
It implements a minimal MCP-compatible JSON-RPC server over stdin/stdout.

Usage:
    python -m mcp_toolshed.server

The server responds to:
    - initialize: Return server capabilities
    - tools/list: Return all registered tool schemas
    - tools/call: Execute a tool and return the result
"""

from __future__ import annotations

import json
import sys

import structlog

from mcp_toolshed.toolshed import MCPToolshed

logger = structlog.get_logger()

toolshed = MCPToolshed()


def send_response(id: int | str | None, result: dict):
    """Send a JSON-RPC response to stdout."""
    response = {"jsonrpc": "2.0", "id": id, "result": result}
    msg = json.dumps(response)
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()


def send_error(id: int | str | None, code: int, message: str):
    """Send a JSON-RPC error to stdout."""
    response = {
        "jsonrpc": "2.0",
        "id": id,
        "error": {"code": code, "message": message},
    }
    msg = json.dumps(response)
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()


async def handle_request(request: dict):
    """Handle a single JSON-RPC request."""
    method = request.get("method", "")
    params = request.get("params", {})
    req_id = request.get("id")

    if method == "initialize":
        send_response(
            req_id,
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {
                    "name": "duckling-toolshed",
                    "version": "0.1.0",
                },
            },
        )

    elif method == "notifications/initialized":
        # Client acknowledgment, no response needed
        pass

    elif method == "tools/list":
        tools = toolshed.get_tool_schemas()
        send_response(req_id, {"tools": tools})

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        result = await toolshed.execute(tool_name, arguments)

        if "error" in result:
            send_response(
                req_id,
                {
                    "content": [{"type": "text", "text": result["error"]}],
                    "isError": True,
                },
            )
        else:
            send_response(
                req_id,
                {
                    "content": [{"type": "text", "text": str(result.get("result", ""))}],
                },
            )

    else:
        send_error(req_id, -32601, f"Method not found: {method}")


async def main():
    """Run the MCP server, reading JSON-RPC messages from stdin."""

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            await handle_request(request)
        except json.JSONDecodeError:
            send_error(None, -32700, "Parse error")
        except Exception as e:
            send_error(None, -32603, f"Internal error: {e}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
