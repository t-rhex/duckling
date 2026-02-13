"""Tests for git integration (L6).

Covers:
- parse_repo_from_url() for GitHub, Bitbucket, SSH, .git suffix
- redact_url() for safe logging
- GitManager._build_pr_body()
"""

from __future__ import annotations

import pytest

from git_integration.git_manager import GitManager, parse_repo_from_url, redact_url
from orchestrator.models.task import GitProvider


class TestParseRepoFromUrl:
    """Test parse_repo_from_url for various URL formats."""

    def test_parse_github_https(self):
        repo, provider = parse_repo_from_url("https://github.com/owner/repo")
        assert repo == "owner/repo"
        assert provider == GitProvider.GITHUB

    def test_parse_github_https_with_dot_git(self):
        repo, provider = parse_repo_from_url("https://github.com/owner/repo.git")
        assert repo == "owner/repo"
        assert provider == GitProvider.GITHUB

    def test_parse_github_ssh(self):
        repo, provider = parse_repo_from_url("git@github.com:owner/repo.git")
        assert repo == "owner/repo"
        assert provider == GitProvider.GITHUB

    def test_parse_github_ssh_without_dot_git(self):
        repo, provider = parse_repo_from_url("git@github.com:owner/repo")
        assert repo == "owner/repo"
        assert provider == GitProvider.GITHUB

    def test_parse_bitbucket_https(self):
        repo, provider = parse_repo_from_url("https://bitbucket.org/workspace/repo")
        assert repo == "workspace/repo"
        assert provider == GitProvider.BITBUCKET

    def test_parse_bitbucket_https_with_dot_git(self):
        repo, provider = parse_repo_from_url("https://bitbucket.org/workspace/repo.git")
        assert repo == "workspace/repo"
        assert provider == GitProvider.BITBUCKET

    def test_parse_bitbucket_ssh(self):
        repo, provider = parse_repo_from_url("git@bitbucket.org:workspace/repo.git")
        assert repo == "workspace/repo"
        assert provider == GitProvider.BITBUCKET

    def test_parse_bitbucket_ssh_without_dot_git(self):
        repo, provider = parse_repo_from_url("git@bitbucket.org:workspace/repo")
        assert repo == "workspace/repo"
        assert provider == GitProvider.BITBUCKET

    def test_parse_invalid_url_raises(self):
        with pytest.raises(ValueError, match="Cannot parse Git URL"):
            parse_repo_from_url("https://gitlab.com/owner/repo")

    def test_parse_empty_string_raises(self):
        with pytest.raises(ValueError, match="Cannot parse Git URL"):
            parse_repo_from_url("")

    def test_parse_random_string_raises(self):
        with pytest.raises(ValueError, match="Cannot parse Git URL"):
            parse_repo_from_url("not-a-url-at-all")

    def test_parse_http_instead_of_https_raises(self):
        """Only HTTPS and SSH are supported."""
        with pytest.raises(ValueError, match="Cannot parse Git URL"):
            parse_repo_from_url("http://github.com/owner/repo")

    def test_parse_github_with_hyphen_in_name(self):
        repo, provider = parse_repo_from_url("https://github.com/my-org/my-repo")
        assert repo == "my-org/my-repo"
        assert provider == GitProvider.GITHUB

    def test_parse_github_with_dots_in_name_raises(self):
        """Repo names with dots (other than .git suffix) are not supported by the regex."""
        with pytest.raises(ValueError, match="Cannot parse Git URL"):
            parse_repo_from_url("https://github.com/org/repo.name")

    def test_parse_github_with_underscore(self):
        repo, provider = parse_repo_from_url("https://github.com/org_name/repo_name")
        assert repo == "org_name/repo_name"
        assert provider == GitProvider.GITHUB


class TestRedactUrl:
    """Test redact_url for credential scrubbing."""

    def test_redact_url_with_credentials(self):
        result = redact_url("https://user:token@github.com/owner/repo")
        assert result == "https://<redacted>@github.com/owner/repo"
        assert "user" not in result
        assert "token" not in result

    def test_redact_url_without_credentials(self):
        url = "https://github.com/owner/repo"
        result = redact_url(url)
        assert result == url

    def test_redact_url_with_only_username(self):
        result = redact_url("https://user@github.com/owner/repo")
        assert result == "https://<redacted>@github.com/owner/repo"

    def test_redact_url_with_token_credentials(self):
        result = redact_url("https://x-access-token:ghp_abc123@github.com/owner/repo")
        assert "<redacted>" in result
        assert "ghp_abc123" not in result


class TestGitManagerBuildPrBody:
    """Test the PR body template generation."""

    def test_build_pr_body_contains_description(self):
        from unittest.mock import patch, MagicMock

        with patch("orchestrator.services.config.get_settings") as mock:
            settings = MagicMock()
            settings.github_token = ""
            settings.bitbucket_username = ""
            settings.bitbucket_app_password = ""
            settings.bitbucket_workspace = ""
            mock.return_value = settings

            manager = GitManager()
            body = manager._build_pr_body("Fix the auth bug", "duckling/abc123")
            assert "Fix the auth bug" in body
            assert "duckling/abc123" in body
            assert "Duckling" in body

    def test_build_pr_body_includes_review_instructions(self):
        from unittest.mock import patch, MagicMock

        with patch("orchestrator.services.config.get_settings") as mock:
            settings = MagicMock()
            settings.github_token = ""
            settings.bitbucket_username = ""
            settings.bitbucket_app_password = ""
            settings.bitbucket_workspace = ""
            mock.return_value = settings

            manager = GitManager()
            body = manager._build_pr_body("description", "branch", "TestAgent")
            assert "pytest" in body
            assert "TestAgent" in body
            assert "AI agent" in body

    def test_build_pr_body_custom_agent_name(self):
        from unittest.mock import patch, MagicMock

        with patch("orchestrator.services.config.get_settings") as mock:
            settings = MagicMock()
            settings.github_token = ""
            settings.bitbucket_username = ""
            settings.bitbucket_app_password = ""
            settings.bitbucket_workspace = ""
            mock.return_value = settings

            manager = GitManager()
            body = manager._build_pr_body("desc", "branch", agent_name="CustomBot")
            assert "CustomBot" in body
