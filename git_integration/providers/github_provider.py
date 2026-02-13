"""GitHub provider — creates PRs, branches, and manages repos via the GitHub API."""

from __future__ import annotations

from typing import Optional

import httpx
import structlog

from orchestrator.services.config import get_settings

from .base import BranchInfo, GitProvider, PRResult

logger = structlog.get_logger()


class GitHubProvider(GitProvider):
    """GitHub integration using the REST API (via httpx, no PyGithub dep needed)."""

    def __init__(self):
        settings = get_settings()
        self.token = settings.github_token
        self.org = settings.github_org
        self.base_url = "https://api.github.com"
        self._client: Optional[httpx.AsyncClient] = None

    async def close(self) -> None:
        """Close the HTTP client to release resources."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                timeout=30.0,
            )
        return self._client

    async def create_branch(
        self, repo: str, branch_name: str, from_branch: str = "main"
    ) -> BranchInfo:
        # Get the SHA of the base branch
        resp = await self.client.get(f"/repos/{repo}/git/ref/heads/{from_branch}")
        resp.raise_for_status()
        base_sha = resp.json()["object"]["sha"]

        # Create the new branch
        resp = await self.client.post(
            f"/repos/{repo}/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": base_sha},
        )
        resp.raise_for_status()

        await logger.ainfo(
            "GitHub branch created", repo=repo, branch=branch_name, base_sha=base_sha[:8]
        )
        return BranchInfo(name=branch_name, sha=base_sha, is_default=False)

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
        # Create the PR
        pr_data = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch,
        }
        resp = await self.client.post(f"/repos/{repo}/pulls", json=pr_data)
        resp.raise_for_status()
        pr = resp.json()

        pr_number = pr["number"]
        pr_url = pr["html_url"]

        # Add labels if provided
        if labels:
            await self.client.post(
                f"/repos/{repo}/issues/{pr_number}/labels",
                json={"labels": labels},
            )

        # Request reviewers if provided
        if reviewers:
            await self.client.post(
                f"/repos/{repo}/pulls/{pr_number}/requested_reviewers",
                json={"reviewers": reviewers},
            )

        await logger.ainfo(
            "GitHub PR created",
            repo=repo,
            pr_number=pr_number,
            pr_url=pr_url,
            title=title,
        )

        return PRResult(
            pr_url=pr_url,
            pr_number=pr_number,
            title=title,
            branch=head_branch,
            provider="github",
        )

    async def add_pr_comment(self, repo: str, pr_number: int, comment: str) -> None:
        resp = await self.client.post(
            f"/repos/{repo}/issues/{pr_number}/comments",
            json={"body": comment},
        )
        resp.raise_for_status()

    async def get_default_branch(self, repo: str) -> str:
        resp = await self.client.get(f"/repos/{repo}")
        resp.raise_for_status()
        return resp.json()["default_branch"]

    async def get_clone_url(self, repo: str) -> str:
        """Return a plain HTTPS clone URL without embedded credentials."""
        return f"https://github.com/{repo}.git"

    def get_credentials(self) -> dict:
        """Return credentials for git authentication (never embed in URLs)."""
        if self.token:
            return {"username": "x-access-token", "password": self.token}
        return {}
