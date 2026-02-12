# Duckling

Open-source autonomous coding agent platform. Describe a task, get a PR.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB.svg)](https://www.python.org/downloads/)
[![CI](https://img.shields.io/github/actions/workflow/status/t-rhex/duckling/ci.yml?branch=main&label=CI)](https://github.com/t-rhex/duckling/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## What is Duckling?

Duckling is an autonomous coding agent platform. An engineer describes a coding task in plain English -- via Slack, a terminal UI, or the REST API -- and Duckling does the rest. It claims a pre-warmed container in milliseconds, runs an AI coding agent (Goose) inside it, and delivers either a fully-tested pull request or a deep code review report. Zero human code written.

The system is inspired by Stripe's internal "Minions" platform, rebuilt from scratch as an open-source project. Where Minions is proprietary and tightly coupled to Stripe's infrastructure, Duckling is self-hosted, provider-agnostic, and designed to work with any OpenAI-compatible LLM backend -- OpenRouter, Anthropic, OpenAI, or local models.

Duckling supports dual modes, automatically classified by its intent engine: **Code Mode** for autonomous PR generation (clone, analyze, plan, code, lint, test, repair, commit, PR) and **Review Mode** for CodeRabbit-style deep code review (AST security scanning, dependency analysis, per-file AI review, cross-file synthesis, and structured report generation).

## Why Duckling?

| Feature | Duckling | OpenHands | Aider | Goose (standalone) |
|---|---|---|---|---|
| Pre-warmed container pool | Yes | No | No | No |
| Slack-native interface | Yes | No | No | No |
| Dual mode (code + review) | Yes | No | No | No |
| 9-step review pipeline | Yes | No | No | No |
| Real-time TUI dashboard | Yes | Web UI | CLI only | CLI only |
| Intent classification | Yes | No | No | No |
| AST security scanning | Yes | No | No | No |
| Self-hosted | Yes | Yes | Yes | Yes |

## Architecture

```
    Slack / TUI / Web UI / CLI / API
            |
            v
    +---------------+
    |  ORCHESTRATOR  |  FastAPI -- task queue, intent classification, routing
    +-------+-------+
            |
            v
    +---------------+
    |  WARM POOL     |  Pre-warmed containers (Firecracker prod / Docker demo)
    +-------+-------+
            |
            v
    +---------------+
    |  AGENT RUNNER  |  AI agent loop inside the container (OpenCode / Goose / Copilot)
    |  (OpenCode)    |  9-step pipeline: setup > analyze > plan > code > lint > test > repair > commit > PR
    +-------+-------+
            |
            v
    +---------------+
    |  GIT MANAGER   |  GitHub + Bitbucket PR creation
    +---------------+
```

## Quick Start

```bash
# Clone
git clone https://github.com/t-rhex/duckling.git
cd duckling

# Configure
cp .env.example .env
# Edit .env -- set your LLM API key (OpenRouter, Anthropic, or OpenAI)

# Start services
docker compose up -d

# Submit a task via the TUI
cd tui && bun install && bun src/index.ts

# Or via CLI
python scripts/duckling-cli.py submit \
  "Fix the flaky test in auth service" \
  --repo https://github.com/your-org/your-repo

# Or via API
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description": "Fix the flaky test", "repo_url": "https://github.com/your-org/your-repo"}'
```

## Web Dashboard

Duckling includes a web dashboard built with Next.js 16, React 19, shadcn/ui, and Tailwind CSS v4. It provides a full-featured UI for managing tasks, monitoring agent execution, and reviewing results.

### Features

- **Dashboard home** -- stat cards, recent tasks, pool health at a glance
- **Task list** -- paginated table with status, mode, priority, duration
- **New task form** -- submit tasks with repo URL, branch, mode, priority, iterations, timeout
- **Task detail** -- live agent log viewer (terminal style), review output markdown renderer, status timeline, metadata sidebar
- **Pool health** -- VM grid visualization with container states
- **Light/dark theme** -- toggle with system preference detection
- **Real-time updates** -- WebSocket integration for live task monitoring

### Building the Dashboard

```bash
cd dashboard
npm install
npm run build        # Outputs static files to dashboard/out/
```

The static export is served by the FastAPI orchestrator -- no Node.js server needed in production. When running via Docker Compose, the `dashboard/out/` directory is volume-mounted and served at the root URL (http://localhost:8000/).

### Development

```bash
cd dashboard
npm run dev          # Starts dev server on http://localhost:3000
```

The dev server proxies API calls to the orchestrator at `http://localhost:8000`.

## The Agent Pipeline

Two modes, automatically classified by the intent engine:

### Code Mode (autonomous PR generation)

```
1. SETUP      Clone repo, install deps              (deterministic)
2. ANALYZE    Agent reads and understands codebase   (AI)
3. PLAN       Agent creates execution plan           (AI)
4. CODE       Agent writes code changes              (AI)
5. LINT       Run ruff/eslint                        (deterministic)
6. TEST       Run pytest/jest                        (deterministic)
7. REPAIR     If tests fail, agent fixes (up to 5x)  (AI -> goto 5)
8. COMMIT     Stage, commit, push                    (deterministic)
9. PR         Create pull request                    (deterministic)
```

### Review Mode (deep code review)

```
Phase 1 -- Deterministic Analysis:
  1. SETUP                Clone and prepare workspace
  2. FILE_INVENTORY       Catalog all changed files
  3. DEPENDENCY_ANALYSIS  Map import graph
  4. CODE_METRICS         Lines, complexity, coverage (scc)
  5. AST_SECURITY_SCAN    Pattern-based vulnerability detection (ast-grep + bandit)

Phase 2 -- AI-Powered Review:
  6. FILE_LEVEL_REVIEW      Per-file deep analysis
  7. CROSS_FILE_SYNTHESIS   Cross-cutting concern detection
  8. REPORT_GENERATION      Structured markdown report
  9. GIT_STATS              Diff statistics
```

## Project Structure

| Directory | Description |
|-----------|-------------|
| `orchestrator/` | FastAPI service -- REST API, WebSocket, task queue, intent classifier |
| `warm_pool/` | Container lifecycle manager (Firecracker + Docker backends) |
| `agent_runner/` | AI agent loop (OpenCode, Goose, Copilot) with 9-step code and review pipelines |
| `git_integration/` | GitHub + Bitbucket abstraction layer |
| `slack_bot/` | Slack bot with slash commands and mentions |
| `tui/` | Terminal UI built with Bun + OpenTUI |
| `gui/` | Desktop app built with Tauri + SolidJS (experimental) |
| `mcp_toolshed/` | MCP tool server for agent extensions |
| `ast_grep_rules/` | AST-based security scanning rules |
| `dashboard/` | Next.js 16 + shadcn/ui web dashboard (static export) |
| `demo_repo/` | Example repo with intentional bugs for testing |
| `scripts/` | CLI tool |
| `tests/` | Test suite (70+ tests) |

## API Reference

```
POST   /api/tasks           Submit a new coding task
GET    /api/tasks            List all tasks (paginated)
GET    /api/tasks/{id}       Get task details + status
DELETE /api/tasks/{id}       Cancel a running task
GET    /api/tasks/{id}/log   Stream agent execution log
GET    /api/pool/stats       Container pool statistics
GET    /api/health           Health check
WS     /ws/tasks/{id}        Real-time task updates via WebSocket
```

## Configuration

Duckling uses [OpenCode](https://opencode.ai) as its default agent engine, which supports 75+ LLM providers. Set these in your `.env`:

```bash
# Agent engine (default: opencode)
AGENT_BACKEND=opencode

# Option 1: OpenCode Zen (curated models, some free — no API key needed)
OPENCODE_ZEN_API_KEY=your-zen-key
OPENCODE_MODEL=opencode/big-pickle           # Free (limited time)
OPENCODE_MODEL=opencode/kimi-k2.5-free       # Free (limited time)
OPENCODE_MODEL=opencode/claude-sonnet-4-5    # Paid via Zen

# Option 2: OpenRouter (access to many models)
OPENAI_API_KEY=sk-or-v1-your-key
OPENAI_HOST=https://openrouter.ai/api/
OPENCODE_MODEL=deepseek/deepseek-chat-v3-0324

# Option 3: Direct Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
OPENCODE_MODEL=anthropic/claude-sonnet-4-5

# Option 4: Direct OpenAI
OPENAI_API_KEY=sk-your-key
OPENCODE_MODEL=openai/gpt-4o
```

Legacy engines (Goose, GitHub Copilot SDK) are still supported by setting `AGENT_BACKEND=goose` or `AGENT_BACKEND=copilot`. See `.env.example` for all configuration options.

## Development

```bash
make install      # Install Python deps
make test         # Run tests
make lint         # Run linter
make typecheck    # Python type checking
make tui          # Launch the TUI
make dev          # Start with Docker Compose
make help         # See all targets
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

## Production vs Demo

| Feature | Demo | Production |
|---------|------|------------|
| Container Backend | Docker | Firecracker microVMs |
| Claim Time | ~500ms | ~5ms |
| Snapshot/Restore | N/A | Full memory + disk |
| Concurrency | 5 tasks | 50+ tasks |
| Queue | In-memory | Redis |
| Database | SQLite | PostgreSQL |

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
