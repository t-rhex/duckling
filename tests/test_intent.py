"""Tests for the intent classifier."""

import pytest

from orchestrator.models.task import TaskMode
from orchestrator.services.intent import classify_intent, IntentResult


class TestIntentClassifier:
    """Test that natural language descriptions are correctly classified."""

    # ── Review intent ────────────────────────────────────────────────

    @pytest.mark.parametrize(
        "description",
        [
            "Please review my code",
            "Tell me about the code quality of this repo",
            "Analyze this codebase for security issues",
            "What do you think about this project?",
            "Just look at the code and tell me what's wrong",
            "Audit the security of this application",
            "Give me an overview of the architecture",
            "Check for any bugs or issues",
            "Identify potential problems in this codebase",
            "Evaluate the test coverage",
            "How is the code quality?",
            "Describe the architecture of this project",
            "Summarize the codebase health",
            "Just review, don't change anything",
            "Are there any security concerns?",
            "Find bugs in this repository",
            "Perform a comprehensive code review",
            "Scan this repo for vulnerabilities",
            "Assess the technical debt",
        ],
    )
    def test_review_intent(self, description: str):
        result = classify_intent(description)
        assert result.mode == TaskMode.REVIEW, (
            f"Expected REVIEW for '{description}', got {result.mode.value} "
            f"(reason: {result.reason})"
        )

    # ── Code intent ──────────────────────────────────────────────────

    @pytest.mark.parametrize(
        "description",
        [
            "Fix the flaky test in the auth service",
            "Add retry logic to the payment handler",
            "Implement a new caching layer for the API",
            "Refactor the database connection pool",
            "Update the README with new API endpoints",
            "Remove the deprecated user_v1 endpoint",
            "Create a new middleware for rate limiting",
            "Build a health check endpoint",
            "Write unit tests for the payment module",
            "Migrate the config from YAML to TOML",
            "Replace the old logging with structured logging",
            "Delete unused helper functions in utils.py",
            "Optimize the database queries in the report generator",
            "Change the default timeout from 30s to 60s",
            "Modify the error handling in the webhook processor",
            "Set up GitHub Actions CI pipeline",
            "Convert the callback-based code to async/await",
            "The login page is broken, please fix it",
            "Make it handle edge cases for empty arrays",
            "Integrate Stripe payment processing",
        ],
    )
    def test_code_intent(self, description: str):
        result = classify_intent(description)
        assert result.mode == TaskMode.CODE, (
            f"Expected CODE for '{description}', got {result.mode.value} "
            f"(reason: {result.reason})"
        )

    # ── Peer review intent ───────────────────────────────────────────

    @pytest.mark.parametrize(
        "description",
        [
            "Review this PR for the new auth flow",
            "Review this pull request before we merge",
            "Review the changes on branch feature/payments",
            "Review the diff between main and dev",
            "Review branch feature/new-dashboard",
        ],
    )
    def test_peer_review_intent(self, description: str):
        result = classify_intent(description)
        assert result.mode == TaskMode.PEER_REVIEW, (
            f"Expected PEER_REVIEW for '{description}', got {result.mode.value} "
            f"(reason: {result.reason})"
        )

    def test_peer_review_with_target_branch(self):
        """When target_branch is provided, it should always be peer_review."""
        result = classify_intent(
            description="Look at this code",
            target_branch="feature/new-dashboard",
        )
        assert result.mode == TaskMode.PEER_REVIEW
        assert result.confidence >= 0.9

    # ── Explicit mode override ───────────────────────────────────────

    def test_explicit_mode_respected(self):
        """If user explicitly sets a mode, classifier should respect it."""
        result = classify_intent(
            description="Review my code please",
            explicit_mode=TaskMode.CODE,
        )
        assert result.mode == TaskMode.CODE
        assert result.confidence == 1.0
        assert "explicitly" in result.reason.lower()

    def test_explicit_review_respected(self):
        result = classify_intent(
            description="Fix all the bugs",
            explicit_mode=TaskMode.REVIEW,
        )
        assert result.mode == TaskMode.REVIEW
        assert result.confidence == 1.0

    # ── Ambiguous / edge cases ───────────────────────────────────────

    def test_empty_description_defaults_to_code(self):
        """With no signals, default to code mode."""
        result = classify_intent("do something with this repository please")
        # No strong signals, should default to code
        assert result.mode == TaskMode.CODE
        assert result.confidence < 0.6

    def test_mixed_signals_review_wins(self):
        """When description says 'review' but also mentions 'fix', review should win if stronger."""
        result = classify_intent(
            "Review this codebase and tell me if there are any bugs to fix"
        )
        assert result.mode == TaskMode.REVIEW

    def test_mixed_signals_code_wins(self):
        """When description is primarily about fixing, code should win."""
        result = classify_intent(
            "Fix the authentication bug and add input validation"
        )
        assert result.mode == TaskMode.CODE

    # ── Confidence levels ────────────────────────────────────────────

    def test_strong_review_has_high_confidence(self):
        result = classify_intent("Just review the code, don't change anything")
        assert result.mode == TaskMode.REVIEW
        assert result.confidence >= 0.7

    def test_strong_code_has_high_confidence(self):
        result = classify_intent("Fix the broken login page and add tests")
        assert result.mode == TaskMode.CODE
        assert result.confidence >= 0.6

    # ── Result structure ─────────────────────────────────────────────

    def test_result_has_reason(self):
        result = classify_intent("Review my code")
        assert result.reason
        assert len(result.reason) > 10

    def test_result_confidence_in_range(self):
        result = classify_intent("Fix the bug")
        assert 0.0 <= result.confidence <= 1.0
