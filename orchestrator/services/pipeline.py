"""
Orchestrator Pipeline — the glue that connects task → VM → agent → PR.

This is the main pipeline that processes tasks end-to-end:

    Slack/Web/CLI
         │
         ▼
    ┌─────────┐     ┌───────────┐     ┌──────────┐     ┌─────────┐
    │  INTAKE  │────▶│  CLAIM VM │────▶│  RUN     │────▶│ CREATE  │
    │  (task)  │     │  (pool)   │     │  AGENT   │     │   PR    │
    └─────────┘     └───────────┘     └──────────┘     └─────────┘
                                           │
                                           ▼
                                    lint → test → repair
                                    (deterministic loop)

Each stage publishes events for real-time monitoring via WebSocket.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Callable, Optional

import structlog

from agent_runner.engine import create_engine
from agent_runner.runner import AgentRunner
from git_integration.git_manager import GitManager
from orchestrator.models.task import Task, TaskMode, TaskStatus
from orchestrator.services.config import get_settings
from warm_pool.pool_manager import WarmPoolManager

logger = structlog.get_logger()


class TaskStore:
    """Simple file-backed task persistence.

    Writes task state to a JSON file so task history survives restarts.
    Running tasks will still be lost, but completed/failed tasks are preserved.
    """

    def __init__(self, path: str = "/tmp/duckling-tasks.json"):
        self._path = Path(path)
        self._tasks: dict[str, Task] = {}
        self._load()

    def _load(self) -> None:
        """Load tasks from disk."""
        if self._path.exists():
            try:
                data = json.loads(self._path.read_text())
                for item in data:
                    task = Task(**item)
                    self._tasks[task.id] = task
                logger.info("Loaded tasks from disk", count=len(self._tasks))
            except Exception as e:
                logger.warning("Failed to load task store", error=str(e))

    def save(self, task: Task) -> None:
        """Save a task to the store."""
        self._tasks[task.id] = task
        self._flush()

    def get(self, task_id: str) -> Optional[Task]:
        return self._tasks.get(task_id)

    def all_tasks(self) -> dict[str, Task]:
        return self._tasks

    def _flush(self) -> None:
        """Write all tasks to disk."""
        try:
            data = [t.model_dump(mode="json") for t in self._tasks.values()]
            self._path.write_text(json.dumps(data, default=str))
        except Exception as e:
            logger.warning("Failed to flush task store", error=str(e))


class TaskPipeline:
    """
    End-to-end task execution pipeline.

    Responsible for:
    1. Claiming a VM from the warm pool
    2. Running the agent loop inside the VM
    3. Creating a PR with the results
    4. Releasing the VM back to the pool
    5. Notifying the requester
    """

    def __init__(
        self,
        pool_manager: WarmPoolManager,
        git_manager: GitManager,
        on_status_change: Optional[Callable] = None,
        on_step_complete: Optional[Callable] = None,
    ):
        self.pool = pool_manager
        self.git = git_manager
        self.on_status_change = on_status_change
        self.on_step_complete = on_step_complete

    async def execute(self, task: Task) -> Task:
        """
        Execute a task end-to-end. Routes to the correct pipeline based on task.mode.

        Returns the updated task with results.
        """
        if task.mode == TaskMode.REVIEW:
            return await self._execute_review(task)
        if task.mode == TaskMode.PEER_REVIEW:
            return await self._execute_peer_review(task)
        return await self._execute_code(task)

    async def _execute_review(self, task: Task) -> Task:
        """
        Review-only pipeline: claim VM → clone → analyze → release VM.

        No branches, no code changes, no PR. Just analysis output.
        """
        try:
            # ── Phase 1: Claim a VM ───────────────────────────────
            await self._update_status(task, TaskStatus.CLAIMING_VM)
            await logger.ainfo("Claiming VM for review task", task_id=task.id)

            vm = await self.pool.claim_vm(task.id)
            task.vm_id = vm.id

            # ── Phase 2: Get clone URL (no branch creation) ───────
            clone_url = await self.git.get_clone_url(task.repo_url, task.git_provider)
            clone_creds = self.git.get_clone_credentials(
                provider=task.git_provider, repo_url=task.repo_url
            )

            # ── Phase 3: Run review-only agent ────────────────────
            await self._update_status(task, TaskStatus.RUNNING)
            await logger.ainfo("Starting review run", task_id=task.id, vm_id=vm.id)

            settings = get_settings()
            engine = create_engine(settings.agent_backend)

            async def _task_step_callback_review(step_result):
                if self.on_step_complete:
                    await self.on_step_complete(task.id, step_result)

            runner = AgentRunner(
                backend=self.pool.backend,
                engine=engine,
                max_repair_iterations=0,
                on_step_complete=_task_step_callback_review,
            )

            result = await asyncio.wait_for(
                runner.run_review(task, vm, clone_url, clone_creds=clone_creds),
                timeout=task.timeout_seconds,
            )

            task.agent_log = result.agent_log

            if not result.success:
                task.mark_failed(result.error)
                await logger.aerror("Review run failed", task_id=task.id, error=result.error)
                return task

            # Extract the review output — prefer the REPORT step, fall back to last step with output
            review_text = ""
            for step in result.steps:
                if step.step.value == "report" and step.output:
                    review_text = step.output
                    break
            if not review_text:
                for step in reversed(result.steps):
                    if step.output:
                        review_text = step.output
                        break

            task.mark_review_completed(review_text)

            await logger.ainfo(
                "Review completed",
                task_id=task.id,
                duration_s=round(task.duration_seconds or 0, 1),
            )

        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            await logger.ainfo("Review cancelled", task_id=task.id)

        except asyncio.TimeoutError:
            task.mark_failed(f"Review timed out after {task.timeout_seconds}s")
            await logger.aerror("Review timed out", task_id=task.id)

        except Exception as e:
            task.mark_failed(str(e))
            await logger.aerror("Review pipeline error", task_id=task.id, error=str(e))

        finally:
            try:
                await self.pool.release_vm(task.id)
            except Exception as e:
                await logger.awarning("VM release failed", task_id=task.id, error=str(e))

        return task

    async def _execute_peer_review(self, task: Task) -> Task:
        """
        Peer review pipeline: claim VM → clone → diff → AI review → release VM.

        Reviews a coworker's branch against the base branch.
        No code changes, no commits, no PR — just review feedback.
        """
        try:
            # ── Phase 1: Claim a VM ───────────────────────────────
            await self._update_status(task, TaskStatus.CLAIMING_VM)
            await logger.ainfo(
                "Claiming VM for peer review",
                task_id=task.id,
                target=task.target_branch,
                base=task.branch,
            )

            vm = await self.pool.claim_vm(task.id)
            task.vm_id = vm.id

            # ── Phase 2: Get clone URL (no branch creation) ───────
            clone_url = await self.git.get_clone_url(task.repo_url, task.git_provider)
            clone_creds = self.git.get_clone_credentials(
                provider=task.git_provider, repo_url=task.repo_url
            )

            # ── Phase 3: Run peer review agent ────────────────────
            await self._update_status(task, TaskStatus.RUNNING)
            await logger.ainfo("Starting peer review", task_id=task.id, vm_id=vm.id)

            settings = get_settings()
            engine = create_engine(settings.agent_backend)

            async def _task_step_callback_peer(step_result):
                if self.on_step_complete:
                    await self.on_step_complete(task.id, step_result)

            runner = AgentRunner(
                backend=self.pool.backend,
                engine=engine,
                max_repair_iterations=0,
                on_step_complete=_task_step_callback_peer,
            )

            result = await asyncio.wait_for(
                runner.run_peer_review(task, vm, clone_url, clone_creds=clone_creds),
                timeout=task.timeout_seconds,
            )

            task.agent_log = result.agent_log
            task.files_changed = result.files_changed

            if not result.success:
                task.mark_failed(result.error)
                await logger.aerror("Peer review failed", task_id=task.id, error=result.error)
                return task

            # Extract feedback — prefer the REPORT step, fall back to last step with output
            review_text = ""
            for step in result.steps:
                if step.step.value == "report" and step.output:
                    review_text = step.output
                    break
            if not review_text:
                for step in reversed(result.steps):
                    if step.output:
                        review_text = step.output
                        break

            task.mark_review_completed(review_text)

            await logger.ainfo(
                "Peer review completed",
                task_id=task.id,
                duration_s=round(task.duration_seconds or 0, 1),
            )

        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            await logger.ainfo("Peer review cancelled", task_id=task.id)

        except asyncio.TimeoutError:
            task.mark_failed(f"Peer review timed out after {task.timeout_seconds}s")
            await logger.aerror("Peer review timed out", task_id=task.id)

        except Exception as e:
            task.mark_failed(str(e))
            await logger.aerror("Peer review pipeline error", task_id=task.id, error=str(e))

        finally:
            try:
                await self.pool.release_vm(task.id)
            except Exception as e:
                await logger.awarning("VM release failed", task_id=task.id, error=str(e))

        return task

    async def _execute_code(self, task: Task) -> Task:
        """
        Full code pipeline: claim VM → branch → run agent → create PR → release VM.
        """
        try:
            # ── Phase 1: Claim a VM ───────────────────────────────
            await self._update_status(task, TaskStatus.CLAIMING_VM)
            await logger.ainfo("Claiming VM for task", task_id=task.id)

            vm = await self.pool.claim_vm(task.id)
            task.vm_id = vm.id

            # ── Phase 2: Setup git branch ─────────────────────────
            clone_url = await self.git.get_clone_url(task.repo_url, task.git_provider)
            clone_creds = self.git.get_clone_credentials(
                provider=task.git_provider, repo_url=task.repo_url
            )
            working_branch = f"duckling/{task.id[:8]}"
            task.working_branch = working_branch

            # Create remote branch first (for GitHub/Bitbucket)
            try:
                await self.git.create_working_branch(
                    task.repo_url, task.id, task.branch, task.git_provider
                )
            except Exception as e:
                await logger.awarning(
                    "Remote branch creation failed (will create locally)", error=str(e)
                )

            # ── Phase 3: Run the agent ────────────────────────────
            await self._update_status(task, TaskStatus.RUNNING)
            await logger.ainfo("Starting agent run", task_id=task.id, vm_id=vm.id)

            settings = get_settings()
            engine = create_engine(settings.agent_backend)

            async def _task_step_callback_code(step_result):
                if self.on_step_complete:
                    await self.on_step_complete(task.id, step_result)

            runner = AgentRunner(
                backend=self.pool.backend,
                engine=engine,
                max_repair_iterations=5,
                on_step_complete=_task_step_callback_code,
            )

            result = await asyncio.wait_for(
                runner.run(task, vm, clone_url, working_branch, clone_creds=clone_creds),
                timeout=task.timeout_seconds,
            )

            task.agent_log = result.agent_log
            task.iterations_used = result.iterations_used
            task.files_changed = result.files_changed
            task.test_results = result.test_results

            if not result.success:
                task.mark_failed(result.error)
                await logger.aerror("Agent run failed", task_id=task.id, error=result.error)
                return task

            # ── Phase 4: Create the PR ────────────────────────────
            await self._update_status(task, TaskStatus.CREATING_PR)

            pr_title = self._generate_pr_title(task)
            pr_result = await self.git.create_pr(
                repo_url=task.repo_url,
                title=pr_title,
                body=task.description,
                head_branch=working_branch,
                base_branch=task.branch,
                provider=task.git_provider,
                labels=task.labels,
            )

            task.mark_completed(pr_result.pr_url, pr_result.pr_number)

            await logger.ainfo(
                "Task completed successfully",
                task_id=task.id,
                pr_url=pr_result.pr_url,
                duration_s=round(task.duration_seconds or 0, 1),
            )

        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            await logger.ainfo("Task cancelled", task_id=task.id)

        except asyncio.TimeoutError:
            task.mark_failed(f"Task timed out after {task.timeout_seconds}s")
            await logger.aerror("Task timed out", task_id=task.id)

        except Exception as e:
            task.mark_failed(str(e))
            await logger.aerror("Pipeline error", task_id=task.id, error=str(e))

        finally:
            # Always release the VM
            try:
                await self.pool.release_vm(task.id)
            except Exception as e:
                await logger.awarning("VM release failed", task_id=task.id, error=str(e))

        return task

    def _generate_pr_title(self, task: Task) -> str:
        """Generate a clean PR title from the task description."""
        desc = task.description.strip()

        # Capitalize and truncate
        if len(desc) > 72:
            desc = desc[:69] + "..."

        # Add prefix
        if not any(
            desc.lower().startswith(p) for p in ["fix", "add", "update", "refactor", "remove"]
        ):
            desc = f"fix: {desc}"

        return desc

    async def _update_status(self, task: Task, status: TaskStatus):
        """Update task status and notify listeners."""
        task.status = status
        if self.on_status_change:
            try:
                await self.on_status_change(task)
            except Exception as e:
                await logger.awarning(
                    "Status change callback failed", task_id=task.id, error=str(e)
                )


class TaskQueue:
    """
    In-memory task queue with priority ordering.
    Production would use Redis/Celery, but this works for the demo.
    """

    def __init__(self, pipeline: TaskPipeline, max_concurrent: int = 5):
        self.pipeline = pipeline
        self.max_concurrent = max_concurrent
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._active: dict[str, asyncio.Task] = {}
        self._tasks: dict[str, Task] = {}
        self._tasks_lock = asyncio.Lock()
        self._running = False
        self._store = TaskStore()
        # Restore previously saved tasks
        self._tasks.update(self._store.all_tasks())

    async def start(self):
        """Start processing tasks from the queue."""
        self._running = True
        self._loop_task = asyncio.create_task(self._process_loop())
        await logger.ainfo("Task queue started", max_concurrent=self.max_concurrent)

    async def stop(self):
        """Stop the task queue, cancelling active tasks and awaiting cleanup."""
        self._running = False
        # Cancel the processing loop
        if hasattr(self, "_loop_task") and self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        # Cancel all active tasks and wait for their finally blocks
        for task in self._active.values():
            task.cancel()
        if self._active:
            await asyncio.gather(*self._active.values(), return_exceptions=True)
        await logger.ainfo("Task queue stopped", active_cancelled=len(self._active))

    async def submit(self, task: Task) -> Task:
        """Submit a task to the queue."""
        async with self._tasks_lock:
            self._tasks[task.id] = task
        self._store.save(task)
        priority = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        await self._queue.put((priority.get(task.priority.value, 2), task.id))
        await logger.ainfo("Task queued", task_id=task.id, priority=task.priority)
        return task

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running or pending task.

        If the task has an active asyncio.Task, cancels it — which raises
        CancelledError inside the pipeline, triggering the finally block
        that releases the VM.  Returns True if the task was found and
        cancelled.
        """
        async with self._tasks_lock:
            task = self._tasks.get(task_id)
        if not task:
            return False

        # Cancel the asyncio task if it's actively running
        async_task = self._active.get(task_id)
        if async_task and not async_task.done():
            async_task.cancel()
            await logger.ainfo("Asyncio task cancelled", task_id=task_id)

        # Mark the domain task as cancelled (the pipeline's CancelledError
        # handler will also do this, but we set it eagerly for immediate
        # visibility in the API response).
        task.status = TaskStatus.CANCELLED
        return True

    async def get_task(self, task_id: str) -> Optional[Task]:
        async with self._tasks_lock:
            return self._tasks.get(task_id)

    async def list_tasks(self, page: int = 1, per_page: int = 20) -> tuple[list[Task], int]:
        async with self._tasks_lock:
            all_tasks = sorted(self._tasks.values(), key=lambda t: t.created_at, reverse=True)
            total = len(all_tasks)
            start = (page - 1) * per_page
            return all_tasks[start : start + per_page], total

    async def _process_loop(self):
        """Main loop that pulls tasks and dispatches them."""
        while self._running:
            try:
                # Clean up completed tasks and retrieve results to surface exceptions
                done = [tid for tid, t in self._active.items() if t.done()]
                for tid in done:
                    try:
                        self._active[tid].result()
                    except Exception as e:
                        await logger.aerror("Unhandled task exception", task_id=tid, error=str(e))
                    del self._active[tid]
                    # Persist final task state
                    task = self._tasks.get(tid)
                    if task:
                        self._store.save(task)

                # Check capacity
                if len(self._active) >= self.max_concurrent:
                    await asyncio.sleep(0.5)
                    continue

                # Get next task
                try:
                    priority, task_id = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                async with self._tasks_lock:
                    task = self._tasks.get(task_id)
                if not task:
                    continue

                # Dispatch
                self._active[task_id] = asyncio.create_task(self.pipeline.execute(task))
                await logger.ainfo("Task dispatched", task_id=task_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                await logger.aerror("Queue processing error", error=str(e))
                await asyncio.sleep(1)
