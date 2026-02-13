"""
REST API routes for the Duckling orchestrator.

Endpoints:
    POST   /api/tasks              — Submit a new coding task
    GET    /api/tasks              — List all tasks (paginated)
    GET    /api/tasks/{id}         — Get task details
    DELETE /api/tasks/{id}         — Cancel a task
    GET    /api/tasks/{id}/log     — Stream agent log in real-time
    GET    /api/pool/stats         — Warm pool statistics
    GET    /api/health             — Health check
    WS     /ws/tasks/{id}          — WebSocket for real-time task updates
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from orchestrator.models.task import (
    Task,
    TaskCreate,
    TaskListResponse,
    TaskMode,
    TaskResponse,
    TaskStatus,
)
from orchestrator.models.vm import WarmPoolStats
from orchestrator.services.intent import classify_intent

router = APIRouter()

# These will be injected by the app factory
_task_queue = None
_pool_manager = None
_ws_connections: dict[str, list[WebSocket]] = {}


def set_dependencies(task_queue, pool_manager):
    global _task_queue, _pool_manager
    _task_queue = task_queue
    _pool_manager = pool_manager


# ── Task endpoints ────────────────────────────────────────────────


@router.post("/api/tasks", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreate):
    """Submit a new coding task to the duckling queue.

    If `mode` is omitted, the system auto-infers intent from the description:
      - "review my code" / "tell me about..." → review
      - "fix the bug" / "add a feature" → code
      - "review branch X" + target_branch → peer_review
    """
    # ── Intent classification ────────────────────────────────────
    intent = classify_intent(
        description=body.description,
        target_branch=body.target_branch,
        explicit_mode=body.mode,
    )
    resolved_mode = intent.mode

    task = Task(
        description=body.description,
        repo_url=body.repo_url,
        branch=body.branch,
        target_branch=body.target_branch,
        git_provider=body.git_provider,
        priority=body.priority,
        mode=resolved_mode,
        labels=body.labels,
        source=body.source,
        requester_id=body.requester_id,
        requester_name=body.requester_name,
        slack_channel_id=body.slack_channel_id,
        slack_thread_ts=body.slack_thread_ts,
        max_iterations=body.max_iterations,
        timeout_seconds=body.timeout_seconds,
    )

    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")

    await _task_queue.submit(task)

    return _task_to_response(task, intent_reason=intent.reason, intent_confidence=intent.confidence)


def _task_to_response(
    task: Task,
    intent_reason: Optional[str] = None,
    intent_confidence: Optional[float] = None,
) -> TaskResponse:
    """Convert a Task model to a TaskResponse."""
    return TaskResponse(
        id=task.id,
        status=task.status,
        description=task.description,
        repo_url=task.repo_url,
        branch=task.branch,
        target_branch=task.target_branch,
        working_branch=task.working_branch,
        git_provider=task.git_provider,
        priority=task.priority,
        mode=task.mode,
        source=task.source,
        requester_name=task.requester_name,
        pr_url=task.pr_url,
        pr_number=task.pr_number,
        error_message=task.error_message,
        iterations_used=task.iterations_used,
        files_changed=task.files_changed,
        review_output=task.review_output,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        duration_seconds=task.duration_seconds,
        intent_reason=intent_reason,
        intent_confidence=intent_confidence,
    )


@router.get("/api/tasks", response_model=TaskListResponse)
async def list_tasks(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List all tasks with pagination."""
    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")

    tasks, total = _task_queue.list_tasks(page=page, per_page=per_page)

    return TaskListResponse(
        tasks=[_task_to_response(t) for t in tasks],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get details for a specific task."""
    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")

    task = _task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return _task_to_response(task)


@router.delete("/api/tasks/{task_id}")
async def cancel_task(task_id: str):
    """Cancel a running or pending task.

    This cancels the underlying asyncio task (if running), which raises
    CancelledError inside the pipeline's try block.  The finally block
    then releases the VM back to the pool.
    """
    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")

    task = _task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Task already {task.status.value}")

    await _task_queue.cancel_task(task_id)
    return {"status": "cancelled", "task_id": task_id}


@router.get("/api/tasks/{task_id}/log")
async def get_task_log(task_id: str):
    """Get the agent execution log for a task."""
    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")

    task = _task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"task_id": task_id, "log": task.agent_log, "status": task.status.value}


# ── Pool stats ────────────────────────────────────────────────────


@router.get("/api/pool/stats", response_model=WarmPoolStats)
async def pool_stats():
    """Get warm pool statistics."""
    if _pool_manager is None:
        raise HTTPException(status_code=503, detail="Pool manager not initialized")
    return _pool_manager.get_stats()


# ── Health check ──────────────────────────────────────────────────


@router.get("/api/health")
async def health_check():
    """System health check."""
    pool_stats_data = _pool_manager.get_stats() if _pool_manager else None
    return {
        "status": "healthy",
        "pool": pool_stats_data.model_dump() if pool_stats_data else None,
        "queue_connected": _task_queue is not None,
    }


# ── WebSocket for real-time updates ──────────────────────────────


@router.websocket("/ws/tasks/{task_id}")
async def task_websocket(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time task updates."""
    await websocket.accept()

    if task_id not in _ws_connections:
        _ws_connections[task_id] = []
    _ws_connections[task_id].append(websocket)

    try:
        while True:
            # Keep connection alive, client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        _ws_connections[task_id].remove(websocket)
        if not _ws_connections[task_id]:
            del _ws_connections[task_id]


async def broadcast_task_update(task_id: str, data: dict):
    """Broadcast an update to all WebSocket clients watching a task."""
    connections = _ws_connections.get(task_id, [])
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            pass
