# Duckling — Architecture Design Document

## 1. Overview & Problem Statement

**Problem:** Engineers spend significant time on routine coding tasks — fixing flaky tests, adding retry logic, updating configurations, resolving lint errors. These tasks are well-defined, repetitive, and don't require architectural decisions.

**Solution:** An autonomous coding agent platform that accepts task descriptions in natural language (via Slack, web UI, or CLI), executes them inside isolated VMs using an AI agent (Goose), and produces fully-tested pull requests — with zero human code written.

**Inspiration:** Stripe's internal "Minions" platform, which ships 1,000+ agent-generated PRs per week. Our implementation adapts their architecture.

## 2. Goals & Non-Goals

### Goals
- Instant task submission from Slack, web UI, or CLI
- Sub-10ms VM claim time via Firecracker snapshot/restore
- Fully autonomous code → lint → test → repair loop
- PR creation on both GitHub and Bitbucket
- Real-time progress monitoring via dashboard and Slack threads
- Self-repair: if tests fail, the agent fixes its own code (up to 5 iterations)
- Production-grade isolation: each task runs in its own Firecracker microVM

### Non-Goals
- Replacing human code review (PRs still require human approval)
- Handling architectural decisions or large-scale refactors
- Supporting non-code tasks (documentation-only, deployment, etc.)
- Multi-repo changes in a single task

## 3. System Architecture

```
    ┌─────────────────────────────────────────────────────────────────────┐
    │                        INGESTION LAYER                             │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
    │  │  Slack    │  │  Web UI  │  │   CLI    │  │  GitHub/BB       │  │
    │  │  Bot      │  │ Dashboard│  │ duckling │  │  Webhooks        │  │
    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │
    └───────┼──────────────┼──────────────┼──────────────┼───────────────┘
            │              │              │              │
            └──────────────┴──────┬───────┴──────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                     ORCHESTRATOR SERVICE                           │
    │                                                                     │
    │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────────────┐  │
    │  │  REST API │  │  Task     │  │  Pipeline │  │  Event         │  │
    │  │  (FastAPI)│  │  Queue    │  │  Engine   │  │  Publisher     │  │
    │  └───────────┘  └───────────┘  └───────────┘  └────────────────┘  │
    └─────────────────────────┬───────────────────────────────────────────┘
                              │
                   ┌──────────┼──────────┐
                   │          │          │
                   ▼          ▼          ▼
    ┌──────────────────┐ ┌──────────┐ ┌──────────────────┐
    │   WARM POOL      │ │  AGENT   │ │  GIT INTEGRATION │
    │   MANAGER        │ │  RUNNER  │ │                  │
    │                  │ │          │ │  ┌────────────┐  │
    │  ┌────────────┐  │ │ Goose    │ │  │  GitHub    │  │
    │  │ Firecracker│  │ │ Agent    │ │  │  Provider  │  │
    │  │ (prod)     │  │ │ Loop     │ │  ├────────────┤  │
    │  ├────────────┤  │ │          │ │  │  Bitbucket │  │
    │  │ Docker     │  │ │ analyze  │ │  │  Provider  │  │
    │  │ (demo)     │  │ │ → code   │ │  └────────────┘  │
    │  └────────────┘  │ │ → lint   │ │                  │
    │                  │ │ → test   │ └──────────────────┘
    │  Snapshot/       │ │ → repair │
    │  Restore         │ │ → commit │
    │  (~5ms claim)    │ │          │
    └──────────────────┘ └──────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │                      MCP TOOLSHED                                  │
    │  ┌────────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌──────────────┐ │
    │  │  Codebase  │ │  Jira    │ │  CI  │ │ Slack │ │  Custom      │ │
    │  │  Search    │ │          │ │      │ │       │ │  Tools       │ │
    │  └────────────┘ └──────────┘ └──────┘ └───────┘ └──────────────┘ │
    └─────────────────────────────────────────────────────────────────────┘
```

## 4. Component Deep Dives

### 4.1 Orchestrator Service

The orchestrator is a FastAPI application that serves as the central brain:

**REST API** (`orchestrator/api/routes.py`)
- CRUD endpoints for tasks
- Pool statistics
- WebSocket endpoint for real-time updates

**Task Queue** (`orchestrator/services/pipeline.py`)
- Priority queue with configurable concurrency (default: 5 concurrent tasks)
- Priority levels: critical > high > medium > low
- In-memory for demo, Redis + Celery for production

**Pipeline Engine** (`orchestrator/services/pipeline.py`)
- Orchestrates the full lifecycle: claim VM → run agent → create PR → release VM
- Handles timeouts, retries, and error recovery
- Publishes events for real-time monitoring

### 4.2 Warm Pool Manager

The warm pool is what makes instant task execution possible:

**Pool Lifecycle:**
```
    create → warm → [READY pool] → claim → run task → release → destroy
                         ↑                                │
                         └── refill loop ←────────────────┘
```

**Docker Backend** (demo):
- Containers from a pre-built image with all tools installed
- ~500ms claim time
- Good enough for demos and development

**Firecracker Backend** (production):
- MicroVMs with snapshot/restore
- ~5ms claim time via memory + disk state restoration
- Copy-on-write disk diffs for efficient multi-tenancy

### 4.3 Agent Runner

The core execution loop that mirrors Stripe's approach:

```
    ┌─────────────────────────────────────────────────┐
    │  1. SETUP: Clone repo, create branch, deps      │  deterministic
    │  2. ANALYZE: Agent reads codebase               │  AI
    │  3. PLAN: Agent creates execution plan          │  AI
    │  4. CODE: Agent writes/modifies code            │  AI
    │  5. LINT: Run ruff/eslint                       │  deterministic
    │  6. TEST: Run pytest/jest                       │  deterministic
    │  7. REPAIR: If tests fail → agent fixes → ↑ 5  │  AI
    │  8. COMMIT: git add, commit, push               │  deterministic
    │  9. PR: Create PR via API                       │  deterministic
    └─────────────────────────────────────────────────┘
```

The repair loop (steps 5-7) is the key innovation: instead of just running the AI once, we gate it with deterministic checks and let it self-repair.

### 4.4 MCP Toolshed

MCP (Model Context Protocol) tools the agent can invoke during execution:

| Tool | Purpose |
|------|---------|
| `codebase_search` | Semantic + grep search across the repo |
| `read_file` | Read file contents |
| `run_tests` | Execute test suite |
| `run_linter` | Run linting with auto-fix |
| `jira_get_issue` | Fetch Jira issue details |
| `jira_add_comment` | Comment on Jira issues |
| `trigger_ci` | Trigger CI pipeline |
| `slack_notify` | Send Slack notifications |

### 4.5 Git Integration

Abstraction layer supporting both GitHub and Bitbucket:

- **GitHub**: REST API with PAT auth, PR creation, labels, reviewers
- **Bitbucket**: REST API v2 with app password auth, PR creation
- **Unified interface**: `GitManager` routes to the correct provider based on repo URL
- **PR templates**: Auto-generated body with task description, files changed, agent details

### 4.6 Slack Bot

Task ingestion from Slack with real-time updates:

- `/duckling <description> --repo <url>` — slash command
- `@duckling <description>` — mention in channels
- Threaded updates as the agent progresses
- Final PR link posted when complete

## 5. Data Flow

### Task Lifecycle

```
1. SUBMIT     Engineer sends "/duckling fix flaky test --repo ..."
2. PARSE      Slack bot parses command, extracts repo URL, priority
3. QUEUE      Task enters priority queue (TaskQueue)
4. CLAIM      Pipeline claims a VM from warm pool (~5ms)
5. SETUP      Clone repo inside VM, create working branch
6. AGENT      Goose analyzes → plans → codes → lint → test → repair
7. PUSH       Commit changes, push to remote branch
8. PR         Create PR via GitHub/Bitbucket API
9. NOTIFY     Post PR link back to Slack thread
10. RELEASE   VM destroyed, pool refills
```

### Real-Time Updates

WebSocket connections from the dashboard receive events at each step:

```json
{
  "task_id": "abc12345",
  "event": "step_complete",
  "step": "test",
  "success": false,
  "metadata": {"passed": 8, "failed": 2},
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 6. Firecracker Warm Pool

### Why Firecracker?

Firecracker microVMs provide:
- **Security**: Full VM-level isolation (not just container namespaces)
- **Speed**: Snapshot/restore in ~5ms vs ~2s for container start
- **Density**: <5MB memory overhead per VM
- **Determinism**: Clean-slate execution for every task

### Snapshot/Restore Flow

```
ONE-TIME (or periodic):
    1. Boot Firecracker VM (kernel + rootfs)
    2. Install: Python, Goose, ruff, pytest, git
    3. Clone target repo + install deps
    4. Pause VM via Firecracker API
    5. Snapshot full state (memory + disk) → "golden image"

PER-TASK (~5ms):
    1. Copy-on-write clone of golden image
    2. Restore VM from snapshot
    3. Resume → VM is running with everything pre-loaded
    4. Agent starts working immediately
```

### Memory Budget

Each VM gets 2048MB RAM and 2 vCPUs by default. On a 256GB host, this supports ~120 concurrent VMs (with overhead).

## 7. Security Model

- **VM Isolation**: Every task runs in its own Firecracker microVM
- **Network Isolation**: VMs have restricted network (only git + API access)
- **Credential Scoping**: Each VM gets minimal credentials (repo-specific PAT)
- **No Persistent State**: VMs are destroyed after each task
- **Tool Constraints**: Goose's tool access is restricted (no file deletion, no network requests)
- **Audit Trail**: Every agent action is logged and associated with a task ID

## 8. Scalability

| Dimension | Demo | Production |
|-----------|------|------------|
| Concurrent tasks | 5 | 50+ |
| VM claim time | ~500ms | ~5ms |
| VM backend | Docker | Firecracker |
| Task queue | In-memory | Redis + Celery |
| Database | In-memory | PostgreSQL |
| Monitoring | Dashboard polling | Prometheus + Grafana |
| Multi-region | No | Yes (via Firecracker pools) |

### Scaling Strategy

1. **Horizontal**: Add more host machines to the Firecracker pool
2. **Queue sharding**: Partition tasks by repo or team
3. **Snapshot caching**: Pre-built snapshots per repo (e.g., one for auth-service, one for payment-service)
4. **Priority lanes**: Critical tasks get dedicated pool capacity

## 9. Production Roadmap

### Phase 1: Hackathon Demo (Current)
- Docker-based warm pool
- In-memory task queue
- Single-machine deployment
- Slack + Web UI + CLI

### Phase 2: Production Alpha
- Firecracker warm pool with snapshot/restore
- Redis + Celery task queue
- PostgreSQL for task persistence
- RBAC + audit logging

### Phase 3: Production GA
- Multi-region deployment
- Per-repo golden snapshots
- CI integration (auto-run on Jira ticket assignment)
- Cost tracking and chargeback
- A/B testing for agent prompts

## 10. Comparison with Stripe Minions

| Feature | Stripe Minions | Duckling |
|---------|---------------|-----------------|
| Agent | Custom Goose fork | Goose (open source) |
| VM | Firecracker | Firecracker (prod) / Docker (demo) |
| Claim time | ~5ms | ~5ms (prod) / ~500ms (demo) |
| Ingestion | Slack, internal UI | Slack, Web UI, CLI |
| Git | GitHub Enterprise | GitHub + Bitbucket |
| Scale | 1000+ PRs/week | Design target: 100+ PRs/week |
| Repair loop | Yes (lint → test → fix) | Yes (identical pattern) |
| MCP tools | Internal tools | Codebase search, Jira, CI, Slack |
