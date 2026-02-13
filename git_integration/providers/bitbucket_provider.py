"""Bitbucket provider — creates PRs, branches, and manages repos via the Bitbucket API."""

from __future__ import annotations

from typing import Optional

import httpx
import structlog

from orchestrator.services.config import get_settings

from .base import BranchInfo, GitProvider, PRResult

logger = structlog.get_logger()


class BitbucketProvider(GitProvider):
    """Bitbucket Cloud integration using the REST API v2."""

    def __init__(self):
        settings = get_settings()
        self.username = settings.bitbucket_username
        self.app_password = settings.bitbucket_app_password
        self.workspace = settings.bitbucket_workspace
        self.base_url = "https://api.bitbucket.org/2.0"
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
                auth=(self.username, self.app_password),
                timeout=30.0,
            )
        return self._client

    async def create_branch(
        self, repo: str, branch_name: str, from_branch: str = "main"
    ) -> BranchInfo:
        # Get the SHA of the base branch
        resp = await self.client.get(f"/repositories/{repo}/refs/branches/{from_branch}")
        resp.raise_for_status()
        base_sha = resp.json()["target"]["hash"]

        # Create branch via the refs API
        resp = await self.client.post(
            f"/repositories/{repo}/refs/branches",
            json={
                "name": branch_name,
                "target": {"hash": base_sha},
            },
        )
        resp.raise_for_status()

        await logger.ainfo("Bitbucket branch created", repo=repo, branch=branch_name)
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
        pr_data = {
            "title": title,
            "description": body,
            "source": {"branch": {"name": head_branch}},
            "destination": {"branch": {"name": base_branch}},
            "close_source_branch": True,
        }

        if reviewers:
            pr_data["reviewers"] = [{"username": r} for r in reviewers]

        resp = await self.client.post(f"/repositories/{repo}/pullrequests", json=pr_data)
        resp.raise_for_status()
        pr = resp.json()

        pr_number = pr["id"]
        pr_url = pr["links"]["html"]["href"]

        await logger.ainfo(
            "Bitbucket PR created",
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
            provider="bitbucket",
        )

    async def add_pr_comment(self, repo: str, pr_number: int, comment: str) -> None:
        resp = await self.client.post(
            f"/repositories/{repo}/pullrequests/{pr_number}/comments",
            json={"content": {"raw": comment}},
        )
        resp.raise_for_status()

    async def get_default_branch(self, repo: str) -> str:
        resp = await self.client.get(f"/repositories/{repo}")
        resp.raise_for_status()
        return resp.json()["mainbranch"]["name"]

    async def get_clone_url(self, repo: str) -> str:
        """Return a plain HTTPS clone URL without embedded credentials."""
        return f"https://bitbucket.org/{repo}.git"

    def get_credentials(self) -> dict:
        """Return credentials for git authentication (never embed in URLs)."""
        if self.username and self.app_password:
            return {"username": self.username, "password": self.app_password}
        return {}
