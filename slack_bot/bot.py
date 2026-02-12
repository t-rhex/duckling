"""
Slack Bot — the entry point for engineers to submit tasks.

Engineers interact via:
1. Slash command: /duckling fix the flaky test in auth service
2. Mention: @duckling add retry logic to the payment handler
3. DM: just describe the task directly

The bot:
- Parses the task description
- Submits it to the orchestrator queue
- Posts real-time updates back to the thread
- Links the final PR when complete
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Optional

import structlog
from slack_bolt.async_app import AsyncApp
from slack_sdk.web.async_client import AsyncWebClient

from orchestrator.models.task import GitProvider, Task, TaskCreate, TaskMode, TaskPriority, TaskSource
from orchestrator.services.config import get_settings
from orchestrator.services.intent import classify_intent

if TYPE_CHECKING:
    from orchestrator.services.pipeline import TaskQueue

logger = structlog.get_logger()


class DucklingSlackBot:
    """
    Slack bot that accepts coding tasks and dispatches them to the Duckling pipeline.
    """

    def __init__(self, task_queue: Optional["TaskQueue"] = None):
        settings = get_settings()
        self.task_queue = task_queue

        self.app = AsyncApp(
            token=settings.slack_bot_token,
            signing_secret=settings.slack_signing_secret,
        )

        # Register handlers
        self._register_handlers()

    def _register_handlers(self):
        """Register all Slack event handlers."""

        @self.app.command("/duckling")
        async def handle_slash_command(ack, command, say, client: AsyncWebClient):
            """Handle /duckling slash commands."""
            await ack()

            text = command.get("text", "").strip()
            if not text:
                await say(
                    text="Usage: `/duckling <task description> [--repo <url>] [--priority high]`\n"
                    "Example: `/duckling fix the flaky test in auth service --repo https://github.com/your-org/your-repo`",
                )
                return

            # Parse the command
            task_params = self._parse_command(text)
            user_id = command["user_id"]
            user_name = command.get("user_name", "unknown")
            channel_id = command["channel_id"]

            if not task_params.get("repo_url"):
                await say(
                    text="Please include a repo URL:\n"
                    "`/duckling fix the flaky test --repo https://github.com/your-org/your-repo`"
                )
                return

            # ── Intent classification ────────────────────────────
            intent = classify_intent(
                description=task_params["description"],
                target_branch=task_params.get("target_branch"),
            )
            resolved_mode = intent.mode

            mode_label = {
                TaskMode.REVIEW: "Reviewing",
                TaskMode.CODE: "Coding",
                TaskMode.PEER_REVIEW: "Peer-reviewing",
            }.get(resolved_mode, "Working on")

            # Post initial status message
            result = await client.chat_postMessage(
                channel=channel_id,
                text=f"Duckling dispatched! {mode_label}: _{task_params['description']}_",
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Duckling dispatched!*\n\n"
                            f"*Task:* {task_params['description']}\n"
                            f"*Mode:* `{resolved_mode.value}` ({intent.reason})\n"
                            f"*Repo:* `{task_params['repo_url']}`\n"
                            f"*Requested by:* <@{user_id}>\n"
                            f"*Status:* Claiming VM...",
                        },
                    },
                    {"type": "divider"},
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "I'll update this thread as I work."
                                + (" A PR will appear when I'm done." if resolved_mode == TaskMode.CODE else ""),
                            }
                        ],
                    },
                ],
            )

            thread_ts = result["ts"]

            # Submit to the task queue
            task = Task(
                description=task_params["description"],
                repo_url=task_params["repo_url"],
                branch=task_params.get("branch", "main"),
                git_provider=task_params.get("provider", GitProvider.GITHUB),
                priority=task_params.get("priority", TaskPriority.MEDIUM),
                mode=resolved_mode,
                source=TaskSource.SLACK,
                requester_id=user_id,
                requester_name=user_name,
                slack_channel_id=channel_id,
                slack_thread_ts=thread_ts,
            )

            if self.task_queue:
                await self.task_queue.submit(task)
                await client.chat_postMessage(
                    channel=channel_id,
                    thread_ts=thread_ts,
                    text=f"Task `{task.id[:8]}` queued. I'm claiming a VM now...",
                )

        @self.app.event("app_mention")
        async def handle_mention(event, say, client: AsyncWebClient):
            """Handle @duckling mentions in channels."""
            text = event.get("text", "")
            # Remove the bot mention
            text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()

            if not text:
                await say(
                    text="Hey! Tell me what to fix:\n"
                    "`@duckling fix the flaky test in auth service --repo https://github.com/your-org/your-repo`",
                    thread_ts=event.get("ts"),
                )
                return

            task_params = self._parse_command(text)
            if not task_params.get("repo_url"):
                await say(
                    text="I need a repo URL to work on. Try:\n"
                    "`@duckling fix the flaky test --repo https://github.com/your-org/your-repo`",
                    thread_ts=event.get("ts"),
                )
                return

            # ── Intent classification ────────────────────────────
            intent = classify_intent(
                description=task_params["description"],
                target_branch=task_params.get("target_branch"),
            )
            resolved_mode = intent.mode

            # Submit task (same flow as slash command)
            task = Task(
                description=task_params["description"],
                repo_url=task_params["repo_url"],
                branch=task_params.get("branch", "main"),
                git_provider=task_params.get("provider", GitProvider.GITHUB),
                priority=task_params.get("priority", TaskPriority.MEDIUM),
                mode=resolved_mode,
                source=TaskSource.SLACK,
                requester_id=event["user"],
                slack_channel_id=event["channel"],
                slack_thread_ts=event.get("ts"),
            )

            if self.task_queue:
                await self.task_queue.submit(task)

            await say(
                text=f"On it! Task `{task.id[:8]}` queued as *{resolved_mode.value}* ({intent.reason}). I'll post updates here.",
                thread_ts=event.get("ts"),
            )

        @self.app.command("/duckling-status")
        async def handle_status(ack, command, say):
            """Check the status of active ducklings."""
            await ack()

            if not self.task_queue:
                await say(text="No task queue connected.")
                return

            tasks, total = self.task_queue.list_tasks(page=1, per_page=5)
            if not tasks:
                await say(text="No active ducklings right now.")
                return

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"Active Ducklings ({total} total)"},
                }
            ]

            for task in tasks:
                status_emoji = {
                    "pending": "hourglass_flowing_sand",
                    "claiming_vm": "rocket",
                    "running": "robot_face",
                    "testing": "test_tube",
                    "creating_pr": "memo",
                    "completed": "white_check_mark",
                    "failed": "x",
                    "cancelled": "stop_sign",
                }.get(task.status.value, "question")

                blocks.append(
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f":{status_emoji}: `{task.id[:8]}` — {task.description[:60]}\n"
                            f"Status: *{task.status.value}*"
                            + (f" | <{task.pr_url}|View PR>" if task.pr_url else ""),
                        },
                    }
                )

            await say(blocks=blocks, text=f"{total} duckling(s) tracked")

    def _parse_command(self, text: str) -> dict:
        """Parse a slash command or mention into task parameters."""
        params: dict = {}

        # Extract --repo flag
        repo_match = re.search(r"--repo\s+(\S+)", text)
        if repo_match:
            params["repo_url"] = repo_match.group(1)
            text = text[: repo_match.start()] + text[repo_match.end() :]

        # Extract --branch flag
        branch_match = re.search(r"--branch\s+(\S+)", text)
        if branch_match:
            params["branch"] = branch_match.group(1)
            text = text[: branch_match.start()] + text[branch_match.end() :]

        # Extract --priority flag
        priority_match = re.search(r"--priority\s+(low|medium|high|critical)", text)
        if priority_match:
            params["priority"] = TaskPriority(priority_match.group(1))
            text = text[: priority_match.start()] + text[priority_match.end() :]

        # Detect provider from URL
        if params.get("repo_url"):
            if "bitbucket" in params["repo_url"]:
                params["provider"] = GitProvider.BITBUCKET
            else:
                params["provider"] = GitProvider.GITHUB

        params["description"] = text.strip()
        return params

    async def post_task_update(self, task: Task, message: str):
        """Post a threaded update to the original Slack message."""
        if not task.slack_channel_id or not task.slack_thread_ts:
            return

        settings = get_settings()
        client = AsyncWebClient(token=settings.slack_bot_token)
        await client.chat_postMessage(
            channel=task.slack_channel_id,
            thread_ts=task.slack_thread_ts,
            text=message,
        )

    async def post_pr_notification(self, task: Task):
        """Post the final PR link to the Slack thread."""
        if not task.pr_url or not task.slack_channel_id:
            return

        settings = get_settings()
        client = AsyncWebClient(token=settings.slack_bot_token)

        await client.chat_postMessage(
            channel=task.slack_channel_id,
            thread_ts=task.slack_thread_ts,
            text=f"PR ready for review: {task.pr_url}",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f":white_check_mark: *PR Ready!*\n\n"
                        f"<{task.pr_url}|View Pull Request>\n\n"
                        f"*Files changed:* {len(task.files_changed)}\n"
                        f"*Iterations:* {task.iterations_used}\n"
                        f"*Duration:* {task.duration_seconds:.0f}s",
                    },
                },
            ],
        )
