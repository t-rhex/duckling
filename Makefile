.DEFAULT_GOAL := help

.PHONY: help install dev dev-local tui test lint lint-fix typecheck typecheck-tui \
        docker-build docker-build-orchestrator docker-build-agent clean format

help: ## Show available targets with descriptions
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'

install: ## Install the project in editable mode with dev extras
	pip install -e ".[dev]"

dev: ## Start the orchestrator with docker compose
	docker compose up -d

dev-local: ## Run orchestrator locally with hot reload
	uvicorn orchestrator.app:create_app --factory --reload --port 8000

tui: ## Run the TUI
	cd tui && bun src/index.ts

test: ## Run pytest
	pytest --tb=short -q

lint: ## Run ruff check
	ruff check .

lint-fix: ## Run ruff check with auto-fix
	ruff check --fix .

typecheck: ## Run mypy on orchestrator
	mypy orchestrator/ --ignore-missing-imports

typecheck-tui: ## Run tsc for TUI
	cd tui && bunx tsc --noEmit

docker-build: docker-build-orchestrator docker-build-agent ## Build both Docker images

docker-build-orchestrator: ## Build the orchestrator Docker image
	docker build -t duckling/orchestrator:latest -f Dockerfile .

docker-build-agent: ## Build the agent-runner Docker image
	docker build -t duckling/agent-runner:latest -f Dockerfile.agent .

clean: ## Remove build artifacts and caches
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache .mypy_cache

format: ## Format code with ruff
	ruff format .
