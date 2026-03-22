# CLAUDE.md - Project Conventions

## Project Overview
Duckling is an open-source autonomous coding agent platform. Engineers describe coding tasks in plain English (via Slack, TUI, REST API, or web dashboard) and Duckling claims a pre-warmed container, runs an AI coding agent, and delivers a pull request or code review report. Dual modes: Code Mode (autonomous PR generation) and Review Mode (deep code review with AST security scanning). Apache 2.0 licensed.

## Build & Test Commands

### Python (backend)
- `make test` — run pytest (4 files, ~30 tests)
- `make lint` — ruff check
- `make format` — ruff format
- `make typecheck` — mypy orchestrator/
- `pip install -e ".[dev]"` — install dev dependencies

### Dashboard (Next.js 16)
- `cd dashboard && npm install && npm run build` — static export to out/
- `cd dashboard && npm run lint` — ESLint
- `cd dashboard && npm run dev` — dev server on :3000

### TUI (Bun)
- `cd tui && bun install && bunx tsc --noEmit` — type check
- `cd tui && bun src/index.ts` — run TUI

### Docker
- `make docker-build` — build both orchestrator and agent-runner images
- `docker compose up -d` — start orchestrator + Redis + agent-runner

## Architecture

```
orchestrator/          — FastAPI backend (REST API, WebSocket, task queue)
  api/routes.py        — API route definitions
  models/              — Pydantic models (task, vm)
  services/            — Config, intent classification, pipeline
agent_runner/          — AI agent loop (runs inside containers)
  opencode/            — OpenCode integration (primary)
  goose/               — Goose integration (legacy)
  copilot/             — GitHub Copilot SDK integration
warm_pool/             — Container lifecycle (Docker dev, Firecracker prod)
git_integration/       — Git provider abstraction (GitHub, Bitbucket)
slack_bot/             — Slack bot (slash commands)
mcp_toolshed/          — MCP tool server for agent extensions
dashboard/             — Next.js 16 + React 19 + shadcn/ui + Tailwind v4
tui/                   — Terminal UI (Bun + @opentui/core)
gui/                   — Desktop app (Tauri + SolidJS, experimental)
tests/                 — Python test suite
ast_grep_rules/        — AST-based security scanning rules
```

## Code Style
- **Python**: ruff (line-length 100, target py311), mypy for type checking
- **TypeScript (dashboard)**: ESLint, Next.js conventions
- **TypeScript (TUI)**: Bun runtime, @opentui/core patterns
- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

## Testing
- **Python**: pytest + pytest-asyncio + pytest-cov. Tests in `tests/` directory
- **Dashboard**: Next.js build serves as validation (static export)
- **TUI**: Type checking only (`tsc --noEmit`)
- CI runs 5 parallel jobs: lint, typecheck, test, tui-typecheck, docker-build

## Key Environment Variables
- `AGENT_BACKEND` — engine choice: "opencode" (default), "goose", or "copilot"
- `OPENAI_API_KEY` / `OPENAI_HOST` — LLM API access (OpenRouter or direct)
- `GITHUB_TOKEN` — PAT for PR creation
- `REDIS_URL` — default: redis://localhost:6379/0
- `USE_DOCKER_FALLBACK=true` — use Docker instead of Firecracker (dev/demo)
- See `.env.example` for full list

## Deployment
- **Dev/demo**: `docker compose up -d` or `./start.sh`
- **Production**: Firecracker microVMs (no automated deploy pipeline)
- Dashboard static files served by FastAPI orchestrator
- No tag-based or branch-based automated releases

## Gotchas
- Dashboard must be built (`npm run build`) before orchestrator can serve it
- Agent containers need Node 22+ and multiple tools pre-installed (see Dockerfile.agent)
- Redis 7 required for task queue and pub/sub
- Firecracker backend requires Linux with KVM — Docker fallback for macOS/dev
- `warm_pool/firecracker/` is a stub that raises `NotImplementedError`
- Some Python tests use asyncio — run with pytest-asyncio installed
