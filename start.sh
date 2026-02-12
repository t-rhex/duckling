#!/usr/bin/env bash
# ============================================
# Duckling — Unified Start Script
# ============================================
# Starts all Duckling services in one command.
#
# Usage:
#   ./start.sh                         Docker mode (default)
#   ./start.sh --dev                   Local dev mode (orchestrator runs natively)
#   ./start.sh --dashboard-dev         Also start Next.js dev server on :3000
#   ./start.sh --skip-build            Skip Docker image and dashboard builds
#   ./start.sh --stop                  Stop all services
#   ./start.sh --help                  Show usage
#
# Modes:
#   Docker (default)  — Everything runs in Docker containers via docker-compose.
#   Dev (--dev)       — Orchestrator runs locally with uvicorn + hot reload.
#                       Redis + agent image still use Docker.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────────
info()    { echo -e "${BLUE}[info]${NC}  $*"; }
ok()      { echo -e "${GREEN}[  ok]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail()    { echo -e "${RED}[fail]${NC}  $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▸ $*${NC}"; }
divider() { echo -e "${DIM}────────────────────────────────────────────${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PIDFILE="$SCRIPT_DIR/.duckling.pids"
REDIS_CONTAINER="duckling-redis-dev"

# ── Defaults ──────────────────────────────────────────────────
MODE="docker"
DASHBOARD_DEV=false
SKIP_BUILD=false
DO_STOP=false

# ── Parse args ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev)           MODE="local"; shift ;;
        --dashboard-dev) DASHBOARD_DEV=true; shift ;;
        --skip-build)    SKIP_BUILD=true; shift ;;
        --stop)          DO_STOP=true; shift ;;
        --help|-h)
            echo ""
            echo -e "${BOLD}Duckling — Start Script${NC}"
            echo ""
            echo "Usage: ./start.sh [flags]"
            echo ""
            echo "Flags:"
            echo "  --dev              Local dev mode (orchestrator runs natively with hot reload)"
            echo "  --dashboard-dev    Also start Next.js dashboard dev server on port 3000"
            echo "  --skip-build       Skip Docker image builds and dashboard build"
            echo "  --stop             Stop all running Duckling services"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./start.sh                          # Docker mode (recommended)"
            echo "  ./start.sh --dev                    # Local dev with hot reload"
            echo "  ./start.sh --dev --dashboard-dev    # Full local dev setup"
            echo "  ./start.sh --stop                   # Stop everything"
            echo ""
            exit 0
            ;;
        *) fail "Unknown flag: $1 (try --help)" ;;
    esac
done

# ── Stop mode ─────────────────────────────────────────────────
stop_all() {
    step "Stopping Duckling services"

    # Kill tracked background processes
    if [[ -f "$PIDFILE" ]]; then
        while IFS='=' read -r name pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null && ok "Stopped $name (PID $pid)" || true
            fi
        done < "$PIDFILE"
        rm -f "$PIDFILE"
    fi

    # Stop docker compose services
    if docker compose ps --quiet 2>/dev/null | grep -q .; then
        docker compose down 2>/dev/null && ok "Docker Compose services stopped" || true
    fi

    # Stop standalone Redis container (dev mode)
    if docker ps -q --filter "name=$REDIS_CONTAINER" 2>/dev/null | grep -q .; then
        docker stop "$REDIS_CONTAINER" >/dev/null 2>&1 && docker rm "$REDIS_CONTAINER" >/dev/null 2>&1
        ok "Stopped standalone Redis container"
    fi

    # Clean up orphaned warm pool containers (created by the orchestrator, not docker compose)
    ORPHANED=$(docker ps -q --filter "name=duckling-vm-" 2>/dev/null)
    if [[ -n "$ORPHANED" ]]; then
        echo "$ORPHANED" | xargs docker stop >/dev/null 2>&1
        echo "$ORPHANED" | xargs docker rm >/dev/null 2>&1
        ORPHAN_COUNT=$(echo "$ORPHANED" | wc -l | tr -d ' ')
        ok "Cleaned up $ORPHAN_COUNT orphaned warm pool container(s)"
    fi

    ok "All services stopped"
}

if $DO_STOP; then
    stop_all
    exit 0
fi

# ── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${YELLOW}  duckling${NC}  ${DIM}autonomous coding agent platform${NC}"
divider
echo -e "  Mode:       ${BOLD}${MODE}${NC}"
echo -e "  Dashboard:  ${BOLD}$(if $DASHBOARD_DEV; then echo "dev server (:3000)"; else echo "static build"; fi)${NC}"
echo -e "  Skip build: ${BOLD}${SKIP_BUILD}${NC}"
divider
echo ""

# ── Prerequisite checks ──────────────────────────────────────
step "Checking prerequisites"

# Docker
if ! command -v docker &>/dev/null; then
    fail "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
fi
if ! docker info &>/dev/null 2>&1; then
    fail "Docker daemon is not running. Start Docker Desktop or the Docker service."
fi
ok "Docker daemon is running"

# Node.js (needed for dashboard build)
if ! command -v node &>/dev/null; then
    warn "Node.js is not installed — dashboard build will be skipped"
    warn "Install Node.js from https://nodejs.org/ for the web dashboard"
    SKIP_DASHBOARD=true
else
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$NODE_VERSION" -lt 18 ]]; then
        warn "Node.js $NODE_VERSION found but 18+ is required — dashboard build will be skipped"
        SKIP_DASHBOARD=true
    else
        ok "Node.js $(node -v) installed"
        SKIP_DASHBOARD=false
    fi
fi

# npm
if ! $SKIP_DASHBOARD && ! command -v npm &>/dev/null; then
    warn "npm is not installed — dashboard build will be skipped"
    SKIP_DASHBOARD=true
fi

# Python (dev mode only)
if [[ "$MODE" == "local" ]]; then
    if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
        fail "Python 3 is required for local dev mode. Install Python 3.10+."
    fi
    PYTHON=$(command -v python3 || command -v python)
    PY_VERSION=$($PYTHON --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
    if [[ "$PY_MAJOR" -lt 3 ]] || { [[ "$PY_MAJOR" -eq 3 ]] && [[ "$PY_MINOR" -lt 10 ]]; }; then
        fail "Python $PY_VERSION found but 3.10+ is required."
    fi
    ok "Python $PY_VERSION installed"

    # Check if uvicorn is available
    if ! $PYTHON -m uvicorn --version &>/dev/null 2>&1; then
        warn "uvicorn not found — installing Python dependencies"
        if pip install -e ".[dev]" --quiet 2>/dev/null; then
            ok "Python dependencies installed"
        else
            fail "Failed to install Python dependencies. Run: pip install -e '.[dev]'"
        fi
    else
        ok "Python dependencies available"
    fi
fi

# .env file
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        warn "Created .env from .env.example — edit it to set your API keys"
        warn "At minimum, configure an LLM backend (see .env for options)"
    else
        warn "No .env file found — the orchestrator may fail without API keys"
    fi
else
    ok ".env file exists"
fi

# ── Build phase ───────────────────────────────────────────────
if ! $SKIP_BUILD; then
    step "Building Docker images"

    # Agent runner image (always needed — the warm pool spawns these)
    if docker image inspect duckling/agent-runner:latest &>/dev/null 2>&1; then
        ok "Agent runner image already exists (use 'make docker-build-agent' to rebuild)"
    else
        info "Building agent runner image (this may take a few minutes on first run)..."
        docker build -t duckling/agent-runner:latest -f Dockerfile.agent . \
            --quiet 2>&1 | tail -1 || fail "Failed to build agent runner image"
        ok "Agent runner image built"
    fi

    # Orchestrator image (docker mode only)
    if [[ "$MODE" == "docker" ]]; then
        info "Building orchestrator image..."
        docker build -t duckling/orchestrator:latest -f Dockerfile . \
            --quiet 2>&1 | tail -1 || fail "Failed to build orchestrator image"
        ok "Orchestrator image built"
    fi

    # Dashboard
    if ! $SKIP_DASHBOARD && ! $DASHBOARD_DEV; then
        step "Building dashboard"
        if [[ ! -d dashboard/node_modules ]]; then
            info "Installing dashboard dependencies..."
            (cd dashboard && npm install --silent 2>&1) || fail "Failed to install dashboard dependencies"
        fi
        info "Building static export..."
        (cd dashboard && npm run build --silent 2>&1) || fail "Dashboard build failed"
        ok "Dashboard built to dashboard/out/"
    elif $DASHBOARD_DEV && ! $SKIP_DASHBOARD; then
        # Just install deps for dev mode
        if [[ ! -d dashboard/node_modules ]]; then
            step "Installing dashboard dependencies"
            (cd dashboard && npm install --silent 2>&1) || fail "Failed to install dashboard dependencies"
            ok "Dashboard dependencies installed"
        fi
    fi
else
    step "Skipping builds (--skip-build)"
    ok "Using existing images and dashboard build"
fi

# ── Port conflict check ───────────────────────────────────────
step "Checking for port conflicts"

check_port() {
    local port=$1
    local in_use=false
    local proc_info=""

    # Method 1: lsof (catches most cases on macOS/Linux)
    local pid=""
    pid=$(lsof -i :"$port" -sTCP:LISTEN -P -n -t 2>/dev/null | head -1) || true
    if [[ -n "$pid" ]]; then
        in_use=true
        local procname=""
        procname=$(ps -p "$pid" -o comm= 2>/dev/null) || true
        proc_info="${procname:-unknown} (PID $pid)"
    fi

    # Method 2: try to bind (catches edge cases lsof misses, e.g. IPv6-only listeners)
    if ! $in_use && command -v python3 &>/dev/null; then
        local bind_result=0
        python3 -c "
import socket, sys
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    s.bind(('0.0.0.0', $port))
    s.close()
except OSError:
    sys.exit(1)
" 2>/dev/null || bind_result=$?
        if [[ "$bind_result" -ne 0 ]]; then
            in_use=true
            proc_info="${proc_info:-unknown process}"
        fi
    fi

    if $in_use; then
        fail "Port $port is already in use by $proc_info. Stop it first or run: ./start.sh --stop"
    fi
}

check_port 8000 "orchestrator"
ok "Port 8000 is available"

if $DASHBOARD_DEV; then
    check_port 3000 "dashboard"
    ok "Port 3000 is available"
fi

# ── Start services ────────────────────────────────────────────
# Clean up old PID file
rm -f "$PIDFILE"

if [[ "$MODE" == "docker" ]]; then
    # ── Docker mode ───────────────────────────────────────────
    step "Starting services (Docker mode)"

    # Build the agent-runner image via docker compose (build-only profile)
    docker compose build agent-runner --quiet 2>/dev/null || true

    # Start Redis + Orchestrator
    docker compose up -d 2>&1 | grep -v "^$" || fail "docker compose up failed"
    ok "Docker Compose services started"

    # Wait for orchestrator health
    info "Waiting for orchestrator to be ready..."
    RETRIES=0
    MAX_RETRIES=30
    until curl -sf http://localhost:8000/api/health >/dev/null 2>&1; do
        RETRIES=$((RETRIES + 1))
        if [[ $RETRIES -ge $MAX_RETRIES ]]; then
            warn "Orchestrator not responding after ${MAX_RETRIES}s — it may still be starting"
            warn "Check logs: docker compose logs -f orchestrator"
            break
        fi
        sleep 1
    done
    if [[ $RETRIES -lt $MAX_RETRIES ]]; then
        ok "Orchestrator is healthy"
    fi

else
    # ── Local dev mode ────────────────────────────────────────
    step "Starting services (local dev mode)"

    # Redis — start standalone container if not already running
    if docker ps --filter "name=$REDIS_CONTAINER" --format '{{.Names}}' 2>/dev/null | grep -q "$REDIS_CONTAINER"; then
        ok "Redis already running ($REDIS_CONTAINER)"
    elif docker compose ps --filter "service=redis" --format '{{.Name}}' 2>/dev/null | grep -q redis; then
        ok "Redis already running (via docker compose)"
    else
        info "Starting Redis container..."
        docker run -d --name "$REDIS_CONTAINER" -p 6379:6379 redis:7-alpine >/dev/null 2>&1 \
            || fail "Failed to start Redis container"
        ok "Redis started on port 6379"
    fi

    # Source .env into current shell for uvicorn
    set -a
    # shellcheck disable=SC1091
    [[ -f .env ]] && source .env
    set +a

    # Ensure REDIS_URL defaults to localhost for local mode
    export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
    export USE_DOCKER_FALLBACK="${USE_DOCKER_FALLBACK:-true}"
    export DUCKLING_ENV="${DUCKLING_ENV:-development}"

    # Start orchestrator with uvicorn
    info "Starting orchestrator with hot reload..."
    $PYTHON -m uvicorn orchestrator.app:create_app --factory --reload --port 8000 \
        > /tmp/duckling-orchestrator.log 2>&1 &
    ORCH_PID=$!
    echo "orchestrator=$ORCH_PID" >> "$PIDFILE"
    ok "Orchestrator starting (PID $ORCH_PID, log: /tmp/duckling-orchestrator.log)"

    # Wait for health
    info "Waiting for orchestrator to be ready..."
    RETRIES=0
    MAX_RETRIES=20
    until curl -sf http://localhost:8000/api/health >/dev/null 2>&1; do
        RETRIES=$((RETRIES + 1))
        if [[ $RETRIES -ge $MAX_RETRIES ]]; then
            warn "Orchestrator not responding after ${MAX_RETRIES}s"
            warn "Check log: tail -f /tmp/duckling-orchestrator.log"
            break
        fi
        # Check if process died
        if ! kill -0 "$ORCH_PID" 2>/dev/null; then
            echo ""
            fail "Orchestrator process exited. Check log: cat /tmp/duckling-orchestrator.log"
        fi
        sleep 1
    done
    if [[ $RETRIES -lt $MAX_RETRIES ]]; then
        ok "Orchestrator is healthy"
    fi
fi

# ── Dashboard dev server (optional) ──────────────────────────
if $DASHBOARD_DEV && ! ${SKIP_DASHBOARD:-false}; then
    step "Starting dashboard dev server"
    (cd dashboard && npm run dev -- --port 3000 > /tmp/duckling-dashboard.log 2>&1) &
    DASH_PID=$!
    echo "dashboard=$DASH_PID" >> "$PIDFILE"

    # Wait for dashboard
    RETRIES=0
    until curl -sf http://localhost:3000 >/dev/null 2>&1; do
        RETRIES=$((RETRIES + 1))
        if [[ $RETRIES -ge 15 ]]; then break; fi
        sleep 1
    done
    ok "Dashboard dev server running (PID $DASH_PID, log: /tmp/duckling-dashboard.log)"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
divider
echo ""
echo -e "${BOLD}${GREEN}  Duckling is running!${NC}"
echo ""
echo -e "  ${BOLD}Orchestrator${NC}   http://localhost:8000"
echo -e "  ${BOLD}API docs${NC}       http://localhost:8000/docs"
echo -e "  ${BOLD}Health${NC}         http://localhost:8000/api/health"

if $DASHBOARD_DEV && ! ${SKIP_DASHBOARD:-false}; then
    echo -e "  ${BOLD}Dashboard${NC}      http://localhost:3000  ${DIM}(dev server, hot reload)${NC}"
elif ! ${SKIP_DASHBOARD:-false} && [[ -d dashboard/out ]]; then
    echo -e "  ${BOLD}Dashboard${NC}      http://localhost:8000  ${DIM}(static build)${NC}"
fi

echo ""
echo -e "  ${DIM}Submit a task:${NC}"
echo -e "  curl -X POST http://localhost:8000/api/tasks \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -d '{\"description\": \"Fix the flaky test\", \"repo_url\": \"https://github.com/org/repo\"}'"
echo ""

if [[ "$MODE" == "docker" ]]; then
    echo -e "  ${DIM}View logs:${NC}     docker compose logs -f orchestrator"
    echo -e "  ${DIM}Stop:${NC}          ./start.sh --stop"
else
    echo -e "  ${DIM}View logs:${NC}     tail -f /tmp/duckling-orchestrator.log"
    echo -e "  ${DIM}Stop:${NC}          ./start.sh --stop"
fi

echo ""
divider
echo ""
