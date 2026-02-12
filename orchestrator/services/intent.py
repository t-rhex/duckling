"""
Intent Classifier — infers task mode from natural language descriptions.

Instead of requiring users to explicitly set mode="review" or mode="code",
this module reads the task description and figures out what the user wants:

    "please review my code"          → review
    "tell me about the code quality"  → review
    "fix the auth bug"                → code
    "add retry logic to payments"     → code
    "review the changes on branch X"  → peer_review

The classifier uses weighted keyword matching with phrase-level patterns.
No LLM call needed — this is fast and deterministic.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from orchestrator.models.task import TaskMode


@dataclass
class IntentResult:
    """Result of intent classification."""

    mode: TaskMode
    confidence: float  # 0.0 to 1.0
    reason: str  # Human-readable explanation of why this mode was chosen


# ── Pattern definitions ──────────────────────────────────────────────────────
#
# Each pattern is (regex, weight). Higher weight = stronger signal.
# Patterns are checked against the lowercased, stripped description.
# The mode with the highest total weight wins.

_REVIEW_PATTERNS: list[tuple[str, float]] = [
    # Explicit review requests
    (r"\breview\b", 3.0),
    (r"\baudit\b", 3.0),
    (r"\banalyze\b", 3.0),
    (r"\banalysis\b", 3.0),
    (r"\bassess\b", 2.5),
    (r"\bassessment\b", 2.5),
    (r"\bevaluate\b", 2.5),
    (r"\bevaluation\b", 2.5),
    (r"\binspect\b", 2.5),
    # "Tell me" / "explain" / "describe" patterns
    (r"\btell me\b", 3.0),
    (r"\bexplain\b", 2.5),
    (r"\bdescribe\b", 2.5),
    (r"\bwhat do you think\b", 3.0),
    (r"\bwhat is wrong\b", 2.0),
    (r"\bwhat are the issues\b", 2.5),
    (r"\bwhat are the problems\b", 2.5),
    # "Look at" / "check" patterns
    (r"\blook at\b", 2.0),
    (r"\bcheck\b", 1.5),
    (r"\bscan\b", 2.0),
    # Quality / health check language
    (r"\bcode quality\b", 3.0),
    (r"\bcode health\b", 3.0),
    (r"\bcode review\b", 4.0),
    (r"\bsecurity review\b", 4.0),
    (r"\bsecurity audit\b", 4.0),
    (r"\bsecurity concerns\b", 3.0),
    (r"\bsecurity issues\b", 3.0),
    (r"\bvulnerabilities\b", 2.5),
    (r"\barchitecture review\b", 4.0),
    (r"\btech debt\b", 2.5),
    (r"\btechnical debt\b", 2.5),
    # "How is" / "how does" / "how good"
    (r"\bhow is\b", 2.0),
    (r"\bhow does\b", 1.5),
    (r"\bhow good\b", 2.0),
    (r"\bhow bad\b", 2.0),
    # Negative signals: user is NOT asking for changes
    (r"\bdon'?t change\b", 3.0),
    (r"\bdon'?t modify\b", 3.0),
    (r"\bdon'?t fix\b", 2.0),
    (r"\bjust review\b", 4.0),
    (r"\bjust look\b", 3.0),
    (r"\bjust check\b", 3.0),
    (r"\bjust tell\b", 3.0),
    (r"\bjust analyze\b", 3.0),
    # Question patterns (asking, not commanding)
    (r"\bany issues\b", 2.0),
    (r"\bany bugs\b", 2.0),
    (r"\bany problems\b", 2.0),
    (r"\bany\b.*\bconcerns\b", 2.0),
    (r"\bidentify\b", 2.0),
    (r"\bfind bugs\b", 2.5),
    (r"\bfind issues\b", 2.5),
    (r"\bfind problems\b", 2.5),
    (r"\bsummarize\b", 2.0),
    (r"\bsummary\b", 2.0),
    (r"\boverview\b", 2.0),
]

_CODE_PATTERNS: list[tuple[str, float]] = [
    # Explicit action verbs (commanding the agent to DO something)
    (r"\bfix\b", 3.0),
    (r"\badd\b", 2.5),
    (r"\bimplement\b", 3.0),
    (r"\bcreate\b", 2.5),
    (r"\bbuild\b", 2.5),
    (r"\bwrite\b", 2.5),
    (r"\brefactor\b", 3.0),
    (r"\bupdate\b", 2.0),
    (r"\bmodify\b", 2.5),
    (r"\bchange\b", 2.0),
    (r"\bremove\b", 2.5),
    (r"\bdelete\b", 2.5),
    (r"\bmigrate\b", 3.0),
    (r"\bconvert\b", 2.5),
    (r"\breplace\b", 2.5),
    (r"\brename\b", 2.5),
    (r"\boptimize\b", 2.0),
    (r"\bimprove\b", 1.5),
    (r"\brewrite\b", 3.0),
    (r"\bintegrate\b", 2.5),
    (r"\binstall\b", 2.0),
    (r"\bconfigure\b", 2.0),
    (r"\bsetup\b", 2.0),
    (r"\bset up\b", 2.0),
    # "Make it" / "make the" patterns
    (r"\bmake it\b", 2.0),
    (r"\bmake the\b", 1.5),
    (r"\bmake sure\b", 1.5),
    # Specific coding tasks
    (r"\bpull request\b", 2.0),
    (r"\bPR\b", 1.5),
    (r"\bcommit\b", 1.5),
    (r"\bpush\b", 1.5),
    # Bug fix language
    (r"\bbug\b", 2.0),
    (r"\bbroken\b", 2.0),
    (r"\bcrash\b", 2.0),
    (r"\berror\b", 1.5),
    (r"\bfailing\b", 2.0),
    (r"\bflaky\b", 2.0),
]

_PEER_REVIEW_PATTERNS: list[tuple[str, float]] = [
    # Explicit PR/branch review
    (r"\breview\s+(this\s+)?pr\b", 5.0),
    (r"\breview\s+(this\s+)?pull\s+request\b", 5.0),
    (r"\breview\s+(this\s+)?branch\b", 5.0),
    (r"\breview\s+(the\s+)?changes\b", 4.0),
    (r"\breview\s+(the\s+)?diff\b", 4.0),
    (r"\bcompare\b.*\bbranch\b", 3.0),
    (r"\bdiff\b.*\bbranch\b", 3.0),
    (r"\bcode\s+review\s+for\s+(the\s+)?branch\b", 5.0),
    (r"\breview\s+what\s+(was|i)\s+(changed|pushed|committed)\b", 4.0),
]


def classify_intent(
    description: str,
    target_branch: str | None = None,
    explicit_mode: TaskMode | None = None,
) -> IntentResult:
    """
    Classify the user's intent from their task description.

    Args:
        description: The natural language task description.
        target_branch: If provided, strongly suggests peer_review mode.
        explicit_mode: If the user explicitly set a mode, we respect it
                       but still return our classification for logging.

    Returns:
        IntentResult with the inferred mode, confidence, and reason.
    """
    # If user explicitly set a mode, respect it
    if explicit_mode is not None:
        return IntentResult(
            mode=explicit_mode,
            confidence=1.0,
            reason=f"User explicitly requested mode='{explicit_mode.value}'",
        )

    text = description.lower().strip()

    # If target_branch is provided, it's almost certainly a peer review
    if target_branch:
        return IntentResult(
            mode=TaskMode.PEER_REVIEW,
            confidence=0.95,
            reason=f"target_branch='{target_branch}' provided — implies peer review",
        )

    # Score each mode
    review_score = _score_patterns(text, _REVIEW_PATTERNS)
    code_score = _score_patterns(text, _CODE_PATTERNS)
    peer_review_score = _score_patterns(text, _PEER_REVIEW_PATTERNS)

    scores = {
        TaskMode.REVIEW: review_score,
        TaskMode.CODE: code_score,
        TaskMode.PEER_REVIEW: peer_review_score,
    }

    # Pick the winner
    best_mode = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_mode]
    total_score = sum(scores.values())

    # Calculate confidence as proportion of total signal
    if total_score == 0:
        # No signals at all — default to code mode (most common use case)
        return IntentResult(
            mode=TaskMode.CODE,
            confidence=0.3,
            reason="No strong intent signals found — defaulting to code mode",
        )

    confidence = best_score / total_score
    runner_up = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0

    # Build reason
    top_matches = _get_top_matches(text, best_mode)
    matches_str = ", ".join(f"'{m}'" for m in top_matches[:3])
    reason = f"Matched {best_mode.value} patterns ({matches_str}) — score {best_score:.1f} vs others"

    # If it's very close, note the ambiguity
    if confidence < 0.55 and runner_up > 0:
        runner_up_mode = [m for m, s in scores.items() if s == runner_up][0]
        reason += f" (close call with {runner_up_mode.value}: {runner_up:.1f})"

    return IntentResult(
        mode=best_mode,
        confidence=round(confidence, 2),
        reason=reason,
    )


def _score_patterns(text: str, patterns: list[tuple[str, float]]) -> float:
    """Sum the weights of all matching patterns."""
    score = 0.0
    for pattern, weight in patterns:
        if re.search(pattern, text):
            score += weight
    return score


def _get_top_matches(text: str, mode: TaskMode) -> list[str]:
    """Get the actual phrases that matched for a given mode (for logging)."""
    patterns = {
        TaskMode.REVIEW: _REVIEW_PATTERNS,
        TaskMode.CODE: _CODE_PATTERNS,
        TaskMode.PEER_REVIEW: _PEER_REVIEW_PATTERNS,
    }[mode]

    matches = []
    for pattern, weight in sorted(patterns, key=lambda x: -x[1]):
        m = re.search(pattern, text)
        if m:
            matches.append(m.group(0))
    return matches
