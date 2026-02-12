# Contributing to Duckling

Thank you for your interest in contributing to Duckling, an autonomous coding agent platform. Contributions of all kinds are welcome -- bug fixes, new features, documentation improvements, and bug reports.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Python 3.10+** (we recommend managing versions with [pyenv](https://github.com/pyenv/pyenv))
- **Docker Desktop** (required for warm pool and container-based agent runs)
- **Bun 1.3+** (for the terminal UI -- see [bun.sh](https://bun.sh))
- **Node.js 22+** (only needed if you are working on the Tauri desktop app in `gui/`)

## Development Setup

```bash
git clone https://github.com/t-rhex/duckling.git
cd duckling
cp .env.example .env
# Edit .env with your API keys
pip install -e ".[dev]"
```

## Running Services

**Orchestrator** (FastAPI backend):

```bash
# Option A: via Docker
docker compose up -d

# Option B: directly with uvicorn
uvicorn orchestrator.app:create_app --factory --reload --port 8000
```

**Terminal UI**:

```bash
cd tui && bun src/index.ts
```

**Tests**:

```bash
pytest
```

**Lint**:

```bash
ruff check .
```

**Type check (Python)**:

```bash
mypy orchestrator/
```

**Type check (TUI)**:

```bash
cd tui && bunx tsc --noEmit
```

## Project Structure

| Directory | Description |
|---|---|
| `orchestrator/` | FastAPI backend -- API routes, task scheduling, state management |
| `agent_runner/` | Goose agent loop -- drives the autonomous coding workflow |
| `warm_pool/` | VM lifecycle management (Firecracker + Docker) |
| `tui/` | Terminal UI built with Bun and TypeScript |
| `gui/` | Desktop application built with Tauri and SolidJS |
| `slack_bot/` | Slack integration for triggering and monitoring agents |
| `git_integration/` | Abstraction layer for GitHub and Bitbucket operations |
| `tests/` | Test suite |

## Submitting Changes

1. Fork the repository.
2. Create a feature branch off `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Make your changes and add tests for any new functionality.
4. Run the full lint and test suite:
   ```bash
   ruff check .
   pytest
   ```
5. Open a pull request against `main`.

Keep pull requests focused. If you are addressing multiple unrelated issues, open separate PRs.

## Code Style

**Python**:
- Ruff for linting and formatting.
- Maximum line length: 100 characters.

**TypeScript** (TUI and GUI):
- Strict mode enabled.
- ESNext target.

**Commit messages**:
- Conventional commits are preferred: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, etc.
- Example: `feat: add retry logic to agent runner`

## Reporting Issues

Use [GitHub Issues](https://github.com/t-rhex/duckling/issues) to report bugs or request features. When filing a bug report, please include:

- A clear description of the problem.
- Steps to reproduce the issue.
- Expected vs. actual behavior.
- Relevant logs or error output.
- Your environment (OS, Python version, Docker version).
