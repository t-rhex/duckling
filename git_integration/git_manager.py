"""Git Manager — unified interface for GitHub and Bitbucket operations."""

from __future__ import annotations

import re
from typing import Optional

import structlog

from orchestrator.models.task import GitProvider as GitProviderEnum
from orchestrator.services.config import get_settings

from .providers.base import GitProvider, PRResult
from .providers.bitbucket_provider import BitbucketProvider
from .providers.github_provider import GitHubProvider

logger = structlog.get_logger()


def redact_url(url: str) -> str:
    """Remove credentials from a URL for safe logging.

    Transforms ``https://user:token@host/path`` into
    ``https://<redacted>@host/path``.  If the URL contains no
    credentials the original string is returned unchanged.
    """
    return re.sub(r"://[^@]+@", "://<redacted>@", url)


def parse_repo_from_url(url: str) -> tuple[str, GitProviderEnum]:
    """
    Parse a Git URL into (owner/repo, provider).

    Supports:
      - https://github.com/owner/repo.git
      - https://github.com/owner/repo
      - git@github.com:owner/repo.git
      - https://bitbucket.org/workspace/repo.git
    """
    # GitHub
    gh_match = re.match(r"(?:https://github\.com/|git@github\.com:)([^/]+/[^/.]+?)(?:\.git)?$", url)
    if gh_match:
        return gh_match.group(1), GitProviderEnum.GITHUB

    # Bitbucket
    bb_match = re.match(
        r"(?:https://bitbucket\.org/|git@bitbucket\.org:)([^/]+/[^/.]+?)(?:\.git)?$", url
    )
    if bb_match:
        return bb_match.group(1), GitProviderEnum.BITBUCKET

    raise ValueError(f"Cannot parse Git URL: {url}")


class GitManager:
    """
    Unified Git operations manager.

    Routes operations to the correct provider (GitHub / Bitbucket)
    based on the repo URL or explicit provider setting.
    """

    def __init__(self):
        self._github = GitHubProvider()
        self._bitbucket = BitbucketProvider()
        self._providers: dict[str, GitProvider] = {
            "github": self._github,
            "bitbucket": self._bitbucket,
        }

    async def close(self) -> None:
        """Close all provider HTTP clients to prevent resource leaks."""
        for provider in self._providers.values():
            if hasattr(provider, "close"):
                await provider.close()

    def _get_provider(self, provider: GitProviderEnum) -> GitProvider:
        if provider == GitProviderEnum.GITHUB:
            return self._github
        elif provider == GitProviderEnum.BITBUCKET:
            return self._bitbucket
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def create_working_branch(
        self,
        repo_url: str,
        task_id: str,
        base_branch: str = "main",
        provider: Optional[GitProviderEnum] = None,
    ) -> str:
        """Create a duckling working branch like 'duckling/fix-flaky-test-abc123'."""
        repo, detected_provider = parse_repo_from_url(repo_url)
        provider = provider or detected_provider

        branch_name = f"duckling/{task_id[:8]}"
        git_provider = self._get_provider(provider)
        await git_provider.create_branch(repo, branch_name, base_branch)

        return branch_name

    async def create_pr(
        self,
        repo_url: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
        provider: Optional[GitProviderEnum] = None,
        labels: Optional[list[str]] = None,
    ) -> PRResult:
        """Create a PR on the appropriate platform."""
        repo, detected_provider = parse_repo_from_url(repo_url)
        provider = provider or detected_provider
        git_provider = self._get_provider(provider)

        # Add the minion label
        all_labels = ["duckling-generated", *(labels or [])]

        # Build a rich PR body
        full_body = self._build_pr_body(body, head_branch)

        result = await git_provider.create_pull_request(
            repo=repo,
            title=title,
            body=full_body,
            head_branch=head_branch,
            base_branch=base_branch,
            labels=all_labels,
        )

        await logger.ainfo("PR created via GitManager", pr_url=result.pr_url, provider=provider)
        return result

    async def add_pr_comment(
        self,
        repo_url: str,
        pr_number: int,
        comment: str,
        provider: Optional[GitProviderEnum] = None,
    ) -> None:
        """Add a comment to an existing PR."""
        repo, detected_provider = parse_repo_from_url(repo_url)
        provider = provider or detected_provider
        git_provider = self._get_provider(provider)
        await git_provider.add_pr_comment(repo, pr_number, comment)

    async def get_clone_url(
        self,
        repo_url: str,
        provider: Optional[GitProviderEnum] = None,
    ) -> str:
        """Get a clone URL (without embedded credentials)."""
        repo, detected_provider = parse_repo_from_url(repo_url)
        provider = provider or detected_provider
        git_provider = self._get_provider(provider)
        return await git_provider.get_clone_url(repo)

    def get_clone_credentials(
        self,
        provider: Optional[GitProviderEnum] = None,
        repo_url: Optional[str] = None,
    ) -> dict:
        """Return credentials for git clone auth, separate from the URL.

        Returns a dict with 'username' and 'password' keys, or empty dict
        if no credentials are configured.
        """
        if provider is None and repo_url:
            _, provider = parse_repo_from_url(repo_url)
        if provider is None:
            return {}
        git_provider = self._get_provider(provider)
        return git_provider.get_credentials()

    def _build_pr_body(self, description: str, branch: str, agent_name: str = "Duckling") -> str:
        return f"""## Duckling-Generated PR

{description}

---

**Branch:** `{branch}`
**Generated by:** Duckling (autonomous coding agent)
**Agent:** {agent_name}

### What was done
- Analyzed the task description
- Read relevant source files
- Implemented the fix/feature
- Ran linting and formatting
- Ran the test suite
- Self-repaired any test failures

### How to review
1. Check the diff for correctness
2. Run the test suite locally: `pytest`
3. Approve and merge if satisfied

> This PR was generated entirely by an AI agent. No human code was written.
> Please review carefully before merging.
"""
