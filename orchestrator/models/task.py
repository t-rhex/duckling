"""Task model — the unit of work in the Duckling platform."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import re

from pydantic import BaseModel, Field, field_validator


class TaskStatus(str, Enum):
    PENDING = "pending"
    CLAIMING_VM = "claiming_vm"
    RUNNING = "running"
    TESTING = "testing"
    CREATING_PR = "creating_pr"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GitProvider(str, Enum):
    GITHUB = "github"
    BITBUCKET = "bitbucket"


class TaskSource(str, Enum):
    SLACK = "slack"
    WEB_UI = "web_ui"
    CLI = "cli"
    API = "api"


class TaskMode(str, Enum):
    CODE = "code"  # Full pipeline: branch → code → lint → test → commit → PR
    REVIEW = "review"  # Analysis only: clone → analyze → summarize (no code changes)
    PEER_REVIEW = (
        "peer_review"  # Diff-based code review: diff target_branch vs base → review feedback
    )


_ALLOWED_REPO_URL_RE = re.compile(
    r"^https://(github\.com|bitbucket\.org)/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+(\.git)?$"
)


class TaskCreate(BaseModel):
    """Request body for creating a new task."""

    description: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="Task description (min 20 chars for accurate intent classification)",
    )
    repo_url: str = Field(..., description="Git repo URL (GitHub or Bitbucket)")

    @field_validator("repo_url")
    @classmethod
    def validate_repo_url(cls, v: str) -> str:
        """Validate repo URL to prevent SSRF attacks."""
        if not _ALLOWED_REPO_URL_RE.match(v):
            raise ValueError(
                "repo_url must be a valid GitHub or Bitbucket HTTPS URL "
                "(e.g., https://github.com/org/repo)"
            )
        return v

    branch: str = Field(default="main", description="Base branch to diff against")
    target_branch: Optional[str] = Field(
        default=None, description="Branch to review (peer_review mode)"
    )
    git_provider: GitProvider = GitProvider.GITHUB
    priority: TaskPriority = TaskPriority.MEDIUM
    mode: Optional[TaskMode] = Field(
        default=None,
        description="Task mode. If omitted, auto-inferred from description "
        "(e.g. 'review my code' → review, 'fix the bug' → code)",
    )
    labels: list[str] = Field(default_factory=list)
    source: TaskSource = TaskSource.API
    requester_id: Optional[str] = None
    requester_name: Optional[str] = None
    slack_channel_id: Optional[str] = None
    slack_thread_ts: Optional[str] = None
    max_iterations: int = Field(default=25, ge=1, le=100)
    timeout_seconds: int = Field(default=600, ge=60, le=3600)


class TaskUpdate(BaseModel):
    """Partial update for a task."""

    status: Optional[TaskStatus] = None
    vm_id: Optional[str] = None
    agent_log: Optional[str] = None
    pr_url: Optional[str] = None
    error_message: Optional[str] = None
    iterations_used: Optional[int] = None
    files_changed: Optional[list[str]] = None
    test_results: Optional[dict] = None


class Task(BaseModel):
    """Full task record."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: TaskStatus = TaskStatus.PENDING
    description: str
    repo_url: str
    branch: str = "main"
    target_branch: Optional[str] = None
    working_branch: Optional[str] = None
    git_provider: GitProvider = GitProvider.GITHUB
    priority: TaskPriority = TaskPriority.MEDIUM
    mode: TaskMode = TaskMode.CODE
    labels: list[str] = Field(default_factory=list)
    source: TaskSource = TaskSource.API
    requester_id: Optional[str] = None
    requester_name: Optional[str] = None
    slack_channel_id: Optional[str] = None
    slack_thread_ts: Optional[str] = None
    max_iterations: int = 25
    timeout_seconds: int = 600

    # Runtime fields
    vm_id: Optional[str] = None
    agent_log: str = ""
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    error_message: Optional[str] = None
    iterations_used: int = 0
    files_changed: list[str] = Field(default_factory=list)
    test_results: Optional[dict] = None
    review_output: Optional[str] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None

    def mark_completed(self, pr_url: str, pr_number: int):
        now = datetime.now(timezone.utc)
        self.status = TaskStatus.COMPLETED
        self.pr_url = pr_url
        self.pr_number = pr_number
        self.completed_at = now
        self.updated_at = now
        self.duration_seconds = (now - self.created_at).total_seconds()

    def mark_review_completed(self, review_output: str):
        now = datetime.now(timezone.utc)
        self.status = TaskStatus.COMPLETED
        self.review_output = review_output
        self.completed_at = now
        self.updated_at = now
        self.duration_seconds = (now - self.created_at).total_seconds()

    def mark_failed(self, error: str):
        now = datetime.now(timezone.utc)
        self.status = TaskStatus.FAILED
        self.error_message = error
        self.completed_at = now
        self.updated_at = now
        self.duration_seconds = (now - self.created_at).total_seconds()


class TaskResponse(BaseModel):
    """API response for a task."""

    id: str
    status: TaskStatus
    description: str
    repo_url: str
    branch: str
    target_branch: Optional[str] = None
    working_branch: Optional[str]
    git_provider: GitProvider
    priority: TaskPriority
    mode: TaskMode = TaskMode.CODE
    source: TaskSource
    requester_name: Optional[str]
    pr_url: Optional[str]
    pr_number: Optional[int]
    error_message: Optional[str]
    iterations_used: int
    files_changed: list[str]
    review_output: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]
    intent_reason: Optional[str] = None
    intent_confidence: Optional[float] = None


class TaskListResponse(BaseModel):
    """Paginated list of tasks."""

    tasks: list[TaskResponse]
    total: int
    page: int
    per_page: int
