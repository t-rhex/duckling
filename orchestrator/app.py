"""
Main FastAPI application — the entry point for Duckling.

Wires together:
- REST API routes (task CRUD, pool stats, health)
- Warm pool manager (VM lifecycle)
- Task pipeline (task → VM → agent → PR)
- Slack bot (task ingestion from Slack)
- WebSocket server (real-time updates)
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from git_integration.git_manager import GitManager
from orchestrator.api.routes import broadcast_task_update, router, set_dependencies
from orchestrator.models.task import Task
from orchestrator.services.config import get_settings
from orchestrator.services.pipeline import TaskPipeline, TaskQueue
from slack_bot.bot import DucklingSlackBot
from warm_pool.pool_manager import WarmPoolManager

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    settings = get_settings()

    # Initialize components
    pool_manager = WarmPoolManager()
    git_manager = GitManager()

    # ── WebSocket + Slack callbacks ────────────────────────────
    slack_bot: DucklingSlackBot | None = None

    async def on_status_change(task: Task):
        """Push status changes to WebSocket clients and Slack."""
        await broadcast_task_update(
            task.id,
            {
                "event": "status_change",
                "task_id": task.id,
                "status": task.status.value,
                "description": task.description,
            },
        )
        if slack_bot:
            status_msg = {
                "claiming_vm": "⚡ Claiming a VM...",
                "running": "🤖 Agent is working...",
                "creating_pr": "📝 Creating pull request...",
                "completed": "✅ Done!",
                "failed": f"❌ Failed: {task.error_message or 'unknown error'}",
            }.get(task.status.value)
            if status_msg:
                await slack_bot.post_task_update(task, status_msg)
            # Post PR notification when task completes with a PR URL
            if task.status.value == "completed" and task.pr_url:
                try:
                    await slack_bot.post_pr_notification(task)
                except Exception as e:
                    await logger.awarning(
                        "Failed to post PR notification to Slack",
                        task_id=task.id,
                        error=str(e),
                    )

    async def on_step_complete(task_id: str, step_result):
        """Push step-level updates to WebSocket clients."""
        await broadcast_task_update(
            task_id,
            {
                "event": "step_complete",
                "task_id": task_id,
                "step": step_result.step.value,
                "success": step_result.success,
                "duration": step_result.duration_seconds,
            },
        )

    pipeline = TaskPipeline(
        pool_manager=pool_manager,
        git_manager=git_manager,
        on_status_change=on_status_change,
        on_step_complete=on_step_complete,
    )

    task_queue = TaskQueue(pipeline=pipeline, max_concurrent=5)

    # Wire up dependencies
    set_dependencies(task_queue, pool_manager)

    # ── Slack bot (optional — only starts if tokens are configured) ──
    if settings.slack_bot_token and settings.slack_signing_secret:
        try:
            slack_bot = DucklingSlackBot(task_queue=task_queue)
            await logger.ainfo("Slack bot initialized")
        except Exception as e:
            await logger.awarning(
                "Slack bot failed to initialize (continuing without it)", error=str(e)
            )

    # Start services
    await pool_manager.start()
    await task_queue.start()

    # ── Production safety checks ─────────────────────────────────
    warnings = settings.validate_production_settings()
    for w in warnings:
        await logger.awarning(w)

    # ── Required API key checks ───────────────────────────────────
    config_warnings = settings.validate_required_keys()
    for w in config_warnings:
        await logger.awarning("Configuration warning", message=w)

    await logger.ainfo(
        "Duckling started",
        env=settings.env,
        pool_size=settings.warm_pool_size,
        docker_fallback=settings.use_docker_fallback,
        slack_enabled=slack_bot is not None,
    )

    yield

    # Shutdown
    await task_queue.stop()
    await pool_manager.stop()
    await git_manager.close()
    await logger.ainfo("Duckling shut down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Duckling",
        description="Duckling — autonomous coding agent platform (inspired by Stripe Minions)",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — restrict origins; override with DUCKLING_CORS_ORIGINS env var
    allowed_origins = os.getenv(
        "DUCKLING_CORS_ORIGINS", "http://localhost:3000,http://localhost:8000"
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # API routes
    app.include_router(router)

    # Static files for the Next.js dashboard (built to dashboard/out/)
    try:
        app.mount(
            "/",
            StaticFiles(directory="dashboard/out", html=True),
            name="dashboard",
        )
    except Exception:
        pass  # Dashboard build may not exist yet

    return app


# For running with uvicorn directly
app = create_app()
