"""Central configuration for the Duckling platform."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel

# Load .env file before reading any env vars
load_dotenv()


class Settings(BaseModel):
    """Application settings loaded from environment variables."""

    # Core
    env: str = os.getenv("DUCKLING_ENV", "development")
    log_level: str = os.getenv("DUCKLING_LOG_LEVEL", "DEBUG")
    secret_key: str = os.getenv("DUCKLING_SECRET_KEY", "dev-secret-key")
    api_key: str = os.getenv("DUCKLING_API_KEY", "")
    host: str = os.getenv("DUCKLING_HOST", "0.0.0.0")
    port: int = int(os.getenv("DUCKLING_PORT", "8000"))

    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./duckling.db")

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Slack
    slack_bot_token: str = os.getenv("SLACK_BOT_TOKEN", "")
    slack_signing_secret: str = os.getenv("SLACK_SIGNING_SECRET", "")
    slack_app_token: str = os.getenv("SLACK_APP_TOKEN", "")

    # GitHub
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    github_org: str = os.getenv("GITHUB_ORG", "")
    github_webhook_secret: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")

    # Bitbucket
    bitbucket_username: str = os.getenv("BITBUCKET_USERNAME", "")
    bitbucket_app_password: str = os.getenv("BITBUCKET_APP_PASSWORD", "")
    bitbucket_workspace: str = os.getenv("BITBUCKET_WORKSPACE", "")

    # Agent Backend Selection
    agent_backend: str = os.getenv("AGENT_BACKEND", "opencode")  # "opencode", "goose", or "copilot"

    # OpenCode Agent (recommended — supports 75+ models, free models via Zen)
    opencode_model: str = os.getenv("OPENCODE_MODEL", "")
    opencode_zen_api_key: str = os.getenv("OPENCODE_ZEN_API_KEY", "")

    # Goose Agent (legacy)
    goose_provider: str = os.getenv("GOOSE_PROVIDER", "openai")
    goose_model: str = os.getenv("GOOSE_MODEL", "deepseek/deepseek-chat-v3-0324")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_host: str = os.getenv("OPENAI_HOST", "https://openrouter.ai/api/")
    goose_max_iterations: int = int(os.getenv("GOOSE_MAX_ITERATIONS", "25"))
    goose_timeout_seconds: int = int(os.getenv("GOOSE_TIMEOUT_SECONDS", "600"))

    # GitHub Copilot SDK
    copilot_model: str = os.getenv("COPILOT_MODEL", "gpt-5")
    copilot_provider_type: str = os.getenv(
        "COPILOT_PROVIDER_TYPE", ""
    )  # "", "anthropic", "openai", "azure"
    copilot_openai_api_key: str = os.getenv("COPILOT_OPENAI_API_KEY", "")

    # Firecracker
    firecracker_binary: str = os.getenv("FIRECRACKER_BINARY", "/usr/local/bin/firecracker")
    firecracker_kernel: str = os.getenv("FIRECRACKER_KERNEL", "/var/lib/duckling/vmlinux")
    firecracker_rootfs: str = os.getenv("FIRECRACKER_ROOTFS", "/var/lib/duckling/rootfs.ext4")
    snapshot_dir: str = os.getenv("FIRECRACKER_SNAPSHOT_DIR", "/var/lib/duckling/snapshots")
    warm_pool_size: int = int(os.getenv("WARM_POOL_SIZE", "10"))
    warm_pool_refill_threshold: int = int(os.getenv("WARM_POOL_REFILL_THRESHOLD", "3"))

    # Review Pipeline
    review_max_files: int = int(os.getenv("REVIEW_MAX_FILES", "25"))
    review_file_size_limit: int = int(os.getenv("REVIEW_FILE_SIZE_LIMIT", "500"))
    review_ast_grep_rules: str = os.getenv("REVIEW_AST_GREP_RULES", "/workspace/ast-grep-rules")
    review_skip_patterns: str = os.getenv(
        "REVIEW_SKIP_PATTERNS",
        "node_modules,dist,build,.git,__pycache__,*.min.js,*.lock,*.map,vendor,target",
    )

    # Docker fallback
    docker_image: str = os.getenv("DOCKER_IMAGE", "duckling/agent-runner:latest")
    docker_network: str = os.getenv("DOCKER_NETWORK", "duckling-net")
    use_docker_fallback: bool = os.getenv("USE_DOCKER_FALLBACK", "true").lower() == "true"

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    def validate_production_settings(self) -> list[str]:
        """Return warnings for insecure settings in production."""
        warnings: list[str] = []
        if self.is_production:
            if self.secret_key in ("dev-secret-key", "change-me-in-production"):
                warnings.append("DUCKLING_SECRET_KEY is set to an insecure default")
            if not self.api_key:
                warnings.append("DUCKLING_API_KEY is not set — API is unauthenticated")
        return warnings

    def validate_required_keys(self) -> list[str]:
        """Check that required API keys are configured for the selected backend.

        Returns a list of warning messages for missing configuration.
        """
        warnings: list[str] = []

        # Check agent backend keys
        if self.agent_backend == "opencode":
            # OpenCode can use free models via Zen, so missing keys are not fatal
            pass
        elif self.agent_backend == "goose":
            if not self.openai_api_key and not self.anthropic_api_key:
                warnings.append("GOOSE backend requires OPENAI_API_KEY or ANTHROPIC_API_KEY")
        elif self.agent_backend == "copilot":
            if not self.openai_api_key:
                warnings.append("COPILOT backend requires OPENAI_API_KEY")

        # Check git provider keys
        if not self.github_token:
            warnings.append("GITHUB_TOKEN is not set — GitHub operations will fail")

        return warnings


@lru_cache
def get_settings() -> Settings:
    return Settings()
