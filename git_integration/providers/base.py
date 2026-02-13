"""Abstract base for Git providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class PRResult:
    """Result of creating a pull request."""

    pr_url: str
    pr_number: int
    title: str
    branch: str
    provider: str


@dataclass
class BranchInfo:
    """Info about a branch."""

    name: str
    sha: str
    is_default: bool


class GitProvider(ABC):
    """Abstract interface for Git hosting providers."""

    @abstractmethod
    async def create_branch(
        self, repo: str, branch_name: str, from_branch: str = "main"
    ) -> BranchInfo:
        """Create a new branch from a base branch."""
        ...

    @abstractmethod
    async def create_pull_request(
        self,
        repo: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
        labels: Optional[list[str]] = None,
        reviewers: Optional[list[str]] = None,
    ) -> PRResult:
        """Create a pull request / merge request."""
        ...

    @abstractmethod
    async def add_pr_comment(self, repo: str, pr_number: int, comment: str) -> None:
        """Add a comment to a PR."""
        ...

    @abstractmethod
    async def get_default_branch(self, repo: str) -> str:
        """Get the default branch name for a repo."""
        ...

    @abstractmethod
    async def get_clone_url(self, repo: str) -> str:
        """Get a clone URL for a repo (without embedded credentials)."""
        ...

    def get_credentials(self) -> dict:
        """Return credentials for git authentication (never embed in URLs).

        Returns a dict with 'username' and 'password' keys, or an empty
        dict if no credentials are configured (e.g. public repos).
        """
        return {}
