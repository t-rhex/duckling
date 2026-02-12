"""
Agent Runner — the core execution loop that mirrors Stripe's Minions architecture.

The runner interleaves AI agent steps with deterministic steps:

    ┌─────────────────────────────────────────────────────┐
    │  1. SETUP: Clone repo, create branch, install deps  │  deterministic
    │  2. ANALYZE: Agent reads codebase, understands task  │  AI (via engine)
    │  3. PLAN: Agent creates an execution plan            │  AI (via engine)
    │  4. CODE: Agent writes/modifies code                 │  AI (via engine)
    │  5. LINT: Deterministic — run ruff/black/eslint      │  deterministic
    │  6. TEST: Deterministic — run pytest/jest/go test     │  deterministic
    │  7. REPAIR: If tests fail → agent fixes → goto 5     │  AI (via engine)
    │  8. COMMIT: Deterministic — git add, commit, push    │  deterministic
    │  9. PR: Create pull request via GitHub/Bitbucket API  │  deterministic
    └─────────────────────────────────────────────────────┘

The "repair loop" (steps 5-7) runs up to max_repair_iterations times.
This is the key insight from Stripe: deterministic steps give you
confidence gates, while the AI handles the creative problem-solving.

The AI agent engine is pluggable (Goose, GitHub Copilot SDK, etc.)
via the AgentEngine abstraction in agent_runner/engine.py.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

import structlog

from agent_runner.engine import AgentEngine
from orchestrator.models.task import Task
from orchestrator.models.vm import VM
from warm_pool.pool_manager import VMBackendDriver

logger = structlog.get_logger()


class StepType(str, Enum):
    SETUP = "setup"
    ANALYZE = "analyze"
    PLAN = "plan"
    CODE = "code"
    LINT = "lint"
    TEST = "test"
    REPAIR = "repair"
    COMMIT = "commit"
    PR = "pr"
    INVENTORY = "inventory"
    DEPS = "deps"
    METRICS = "metrics"
    SECURITY = "security"
    FILE_REVIEW = "file_review"
    SYNTHESIS = "synthesis"
    REPORT = "report"


@dataclass
class StepResult:
    step: StepType
    success: bool
    output: str = ""
    error: str = ""
    duration_seconds: float = 0.0
    metadata: dict = field(default_factory=dict)


@dataclass
class AgentRunResult:
    """Final result of an agent run."""

    success: bool
    steps: list[StepResult] = field(default_factory=list)
    files_changed: list[str] = field(default_factory=list)
    test_results: dict = field(default_factory=dict)
    total_duration_seconds: float = 0.0
    iterations_used: int = 0
    commit_sha: str = ""
    error: str = ""
    agent_log: str = ""


class AgentRunner:
    """
    Runs an AI agent inside a VM with the deterministic step loop.

    This is the heart of the Duckling system. It:
    1. Sets up the workspace (clone, branch, deps)
    2. Invokes the AI engine to analyze and code
    3. Runs lint/test as confidence gates
    4. Loops on repair if tests fail
    5. Commits and pushes the result

    The AI engine is pluggable via the AgentEngine interface.
    Deterministic steps (setup, lint, test, commit) are always the same.
    """

    def __init__(
        self,
        backend: VMBackendDriver,
        engine: AgentEngine,
        max_repair_iterations: int = 5,
        on_step_complete: Optional[Callable] = None,
    ):
        self.backend = backend
        self.engine = engine
        self.max_repair_iterations = max_repair_iterations
        self.on_step_complete = on_step_complete

    async def run_review(self, task: Task, vm: VM, clone_url: str) -> AgentRunResult:
        """
        Execute a CodeRabbit-style multi-pass review pipeline:

        Phase 1 (Deterministic): SETUP → INVENTORY → DEPS → METRICS → SECURITY
        Phase 2 (AI): FILE_REVIEW (per-file, top N files) → SYNTHESIS → REPORT

        This produces a structured, thorough review by pre-processing the codebase
        deterministically before involving the LLM.
        """
        start = time.monotonic()
        result = AgentRunResult(success=False)
        log_lines: list[str] = []

        def log(msg: str):
            log_lines.append(msg)
            result.agent_log = "\n".join(log_lines)

        try:
            log(f"🔧 Agent engine: {self.engine.name}")
            log("📋 Mode: DEEP REVIEW (CodeRabbit-style multi-pass analysis)")
            log("")

            # ═══════════════════════════════════════════════════════════════
            # PHASE 1: Deterministic Pre-Processing (no LLM)
            # ═══════════════════════════════════════════════════════════════

            # ── Step 1: SETUP — clone repo ───────────────────────────────
            log("▶ Step 1/9: Cloning repository...")
            setup_result = await self._step_setup_review(vm, clone_url, task.branch)
            result.steps.append(setup_result)
            await self._notify(setup_result)
            if not setup_result.success:
                result.error = f"Setup failed: {setup_result.error}"
                return result
            log(f"  ✓ Repo cloned (branch '{task.branch}')")

            # ── Step 2: FILE INVENTORY — scan and classify all files ─────
            log("▶ Step 2/9: Scanning file inventory...")
            inventory_result = await self._step_file_inventory(vm)
            result.steps.append(inventory_result)
            await self._notify(inventory_result)
            log(f"  ✓ {inventory_result.metadata.get('total_files', '?')} files scanned")

            # ── Step 3: DEPENDENCY ANALYSIS — parse manifests ────────────
            log("▶ Step 3/9: Analyzing dependencies...")
            deps_result = await self._step_dependency_analysis(vm)
            result.steps.append(deps_result)
            await self._notify(deps_result)
            log(f"  ✓ Dependencies analyzed")

            # ── Step 4: CODE METRICS — lines, complexity, stats ──────────
            log("▶ Step 4/9: Computing code metrics...")
            metrics_result = await self._step_code_metrics(vm)
            result.steps.append(metrics_result)
            await self._notify(metrics_result)
            log(f"  ✓ Code metrics computed")

            # ── Step 5: SECURITY SCAN — AST-based pattern matching ───────
            log("▶ Step 5/9: Running AST security scan...")
            security_result = await self._step_ast_security_scan(vm)
            result.steps.append(security_result)
            await self._notify(security_result)
            findings_count = security_result.metadata.get("findings_count", 0)
            log(f"  ✓ Security scan complete ({findings_count} findings)")

            # ═══════════════════════════════════════════════════════════════
            # PHASE 2: AI-Powered Deep Analysis
            # ═══════════════════════════════════════════════════════════════

            # Build the pre-processed context for the LLM
            pre_context = self._build_review_context(
                inventory_result, deps_result, metrics_result, security_result
            )

            # ── Start the AI engine ──────────────────────────────────────
            log(f"▶ Starting {self.engine.name} engine...")
            await self.engine.start(vm, task, self.backend)
            log(f"  ✓ {self.engine.name} engine ready")

            # ── Step 6: FILE-LEVEL REVIEW — per-file AI analysis ─────────
            log("▶ Step 6/9: AI reviewing key files...")
            top_files = inventory_result.metadata.get("top_files", [])
            file_review_result = await self._step_file_level_review(
                task, vm, pre_context, top_files
            )
            result.steps.append(file_review_result)
            await self._notify(file_review_result)
            log(f"  ✓ {len(top_files)} files reviewed in detail")

            # ── Step 7: CROSS-FILE SYNTHESIS — architectural analysis ────
            log("▶ Step 7/9: AI synthesizing cross-file analysis...")
            synthesis_result = await self._step_cross_file_synthesis(
                task, pre_context, file_review_result.output
            )
            result.steps.append(synthesis_result)
            await self._notify(synthesis_result)
            log("  ✓ Architecture analysis complete")

            # ── Step 8: REPORT GENERATION — structured output ────────────
            log("▶ Step 8/9: Generating structured report...")
            report_result = await self._step_generate_report(
                task,
                pre_context,
                file_review_result.output,
                synthesis_result.output,
                security_result.output,
            )
            result.steps.append(report_result)
            await self._notify(report_result)
            log("  ✓ Report generated")

            # ── Step 9: GIT STATS — commit history analysis ──────────────
            log("▶ Step 9/9: Analyzing git history...")
            git_stats_result = await self._step_git_stats(vm)
            result.steps.append(git_stats_result)
            await self._notify(git_stats_result)
            log("  ✓ Git history analyzed")

            result.success = True
            result.commit_sha = ""
            result.files_changed = []
            log("")
            log("═══ REVIEW OUTPUT ═══")
            log(report_result.output)

            # Append git stats as a footer
            if git_stats_result.output.strip():
                log("")
                log("═══ GIT ACTIVITY ═══")
                log(git_stats_result.output)

        except asyncio.TimeoutError:
            result.error = f"Task timed out after {task.timeout_seconds}s"
            log(f"  ✗ {result.error}")
        except Exception as e:
            result.error = str(e)
            log(f"  ✗ Unexpected error: {e}")
            await logger.aerror("Review run failed", task_id=task.id, error=str(e))
        finally:
            await self.engine.stop()
            result.total_duration_seconds = time.monotonic() - start
            result.agent_log = "\n".join(log_lines)

        return result

    async def run_peer_review(self, task: Task, vm: VM, clone_url: str) -> AgentRunResult:
        """Execute a peer review: clone → diff target vs base → AI reviews the diff."""
        start = time.monotonic()
        result = AgentRunResult(success=False)
        log_lines: list[str] = []

        def log(msg: str):
            log_lines.append(msg)
            result.agent_log = "\n".join(log_lines)

        try:
            log(f"🔧 Agent engine: {self.engine.name}")
            log(f"📋 Mode: PEER REVIEW (diff {task.target_branch} vs {task.branch})")

            # ── Step 1: SETUP — clone and fetch both branches ──────────
            log("▶ Step 1/4: Cloning repository...")
            setup_result = await self._step_setup_peer_review(
                vm,
                clone_url,
                task.branch,
                task.target_branch,
            )
            result.steps.append(setup_result)
            await self._notify(setup_result)
            if not setup_result.success:
                result.error = f"Setup failed: {setup_result.error}"
                return result
            log(f"  ✓ Repo cloned, checked out '{task.target_branch}'")

            # ── Step 2: Get the diff (deterministic) ───────────────────
            log(f"▶ Step 2/4: Computing diff ({task.branch}..{task.target_branch})...")
            diff_result = await self._step_get_diff(vm, task.branch, task.target_branch)
            result.steps.append(diff_result)
            await self._notify(diff_result)
            if not diff_result.output.strip():
                log("  ⓘ No changes found between branches")
                result.success = True
                log("")
                log("═══ PEER REVIEW OUTPUT ═══")
                log(f"No differences found between '{task.branch}' and '{task.target_branch}'.")
                return result
            diff_stats = diff_result.metadata.get("stats", "")
            log(f"  ✓ Diff computed ({diff_stats})")

            # ── Start the AI engine ────────────────────────────────────
            log(f"▶ Starting {self.engine.name} engine...")
            await self.engine.start(vm, task, self.backend)
            log(f"  ✓ {self.engine.name} engine ready")

            # ── Step 3: AI reviews the diff ────────────────────────────
            log("▶ Step 3/4: Agent reviewing code changes...")
            review_result = await self._step_peer_review(task, diff_result.output)
            result.steps.append(review_result)
            await self._notify(review_result)
            log("  ✓ Code review complete")

            # ── Step 4: Generate structured feedback ───────────────────
            log("▶ Step 4/4: Generating review feedback...")
            feedback_result = await self._step_peer_review_feedback(task)
            result.steps.append(feedback_result)
            await self._notify(feedback_result)

            result.success = True
            result.files_changed = diff_result.metadata.get("files", [])
            log("  ✓ Peer review complete")
            log("")
            log("═══ PEER REVIEW OUTPUT ═══")
            log(feedback_result.output)

        except asyncio.TimeoutError:
            result.error = f"Task timed out after {task.timeout_seconds}s"
            log(f"  ✗ {result.error}")
        except Exception as e:
            result.error = str(e)
            log(f"  ✗ Unexpected error: {e}")
            await logger.aerror("Peer review failed", task_id=task.id, error=str(e))
        finally:
            await self.engine.stop()
            result.total_duration_seconds = time.monotonic() - start
            result.agent_log = "\n".join(log_lines)

        return result

    async def run(self, task: Task, vm: VM, clone_url: str, working_branch: str) -> AgentRunResult:
        """Execute the full agent loop for a task."""
        start = time.monotonic()
        result = AgentRunResult(success=False)
        log_lines: list[str] = []

        def log(msg: str):
            log_lines.append(msg)
            result.agent_log = "\n".join(log_lines)

        try:
            log(f"🔧 Agent engine: {self.engine.name}")

            # ── Step 1: SETUP (deterministic) ─────────────────────────
            log("▶ Step 1/8: Setting up workspace...")
            setup_result = await self._step_setup(vm, clone_url, working_branch, task.branch)
            result.steps.append(setup_result)
            await self._notify(setup_result)
            if not setup_result.success:
                result.error = f"Setup failed: {setup_result.error}"
                return result
            log(f"  ✓ Repo cloned, branch '{working_branch}' created")

            # ── Start the AI engine ───────────────────────────────────
            log(f"▶ Starting {self.engine.name} engine...")
            await self.engine.start(vm, task, self.backend)
            log(f"  ✓ {self.engine.name} engine ready")

            # ── Step 2: ANALYZE (AI) ──────────────────────────────────
            log("▶ Step 2/8: Agent analyzing codebase...")
            analyze_result = await self._step_analyze(task)
            result.steps.append(analyze_result)
            await self._notify(analyze_result)
            log("  ✓ Analysis complete")

            # ── Step 3: PLAN (AI) ─────────────────────────────────────
            log("▶ Step 3/8: Agent creating execution plan...")
            plan_result = await self._step_plan(task)
            result.steps.append(plan_result)
            await self._notify(plan_result)
            log("  ✓ Plan created")

            # ── Step 4: CODE (AI) ─────────────────────────────────────
            log("▶ Step 4/8: Agent writing code...")
            code_result = await self._step_code(task)
            result.steps.append(code_result)
            await self._notify(code_result)
            if not code_result.success:
                result.error = f"Coding failed: {code_result.error}"
                return result
            log("  ✓ Code changes written")

            # ── Steps 5-7: LINT → TEST → REPAIR loop ─────────────────
            for iteration in range(1, self.max_repair_iterations + 1):
                result.iterations_used = iteration
                log(f"▶ Step 5/8: Running linter (iteration {iteration})...")

                # LINT (deterministic)
                lint_result = await self._step_lint(vm)
                result.steps.append(lint_result)
                await self._notify(lint_result)

                if not lint_result.success:
                    log("  ✗ Lint failed, agent repairing...")
                    repair_result = await self._step_repair("lint", lint_result.error)
                    result.steps.append(repair_result)
                    await self._notify(repair_result)
                    continue

                log("  ✓ Lint passed")
                log(f"▶ Step 6/8: Running tests (iteration {iteration})...")

                # TEST (deterministic)
                test_result = await self._step_test(vm)
                result.steps.append(test_result)
                result.test_results = test_result.metadata
                await self._notify(test_result)

                if not test_result.success:
                    log(f"  ✗ Tests failed ({test_result.metadata.get('failed', '?')} failures)")
                    log("▶ Step 7/8: Agent self-repairing...")
                    repair_result = await self._step_repair("test", test_result.output)
                    result.steps.append(repair_result)
                    await self._notify(repair_result)
                    continue

                log("  ✓ All tests passed!")
                break
            else:
                result.error = f"Max repair iterations ({self.max_repair_iterations}) exhausted"
                log(f"  ✗ {result.error}")
                return result

            # ── Step 8: COMMIT & PUSH (deterministic) ─────────────────
            log("▶ Step 8/8: Committing and pushing...")
            commit_result = await self._step_commit(vm, task, working_branch)
            result.steps.append(commit_result)
            await self._notify(commit_result)

            if not commit_result.success:
                result.error = f"Commit/push failed: {commit_result.error}"
                return result

            result.commit_sha = commit_result.metadata.get("sha", "")
            result.files_changed = commit_result.metadata.get("files", [])
            result.success = True
            log(f"  ✓ Changes pushed to '{working_branch}'")
            log(f"  ✓ Commit: {result.commit_sha[:8]}")

        except asyncio.TimeoutError:
            result.error = f"Task timed out after {task.timeout_seconds}s"
            log(f"  ✗ {result.error}")
        except Exception as e:
            result.error = str(e)
            log(f"  ✗ Unexpected error: {e}")
            await logger.aerror("Agent run failed", task_id=task.id, error=str(e))
        finally:
            # Always stop the engine
            await self.engine.stop()
            result.total_duration_seconds = time.monotonic() - start
            result.agent_log = "\n".join(log_lines)

        return result

    # ── Deterministic step implementations ─────────────────────────────

    async def _step_setup(
        self, vm: VM, clone_url: str, branch: str, base_branch: str
    ) -> StepResult:
        """Clone repo, create working branch, install deps."""
        start = time.monotonic()
        commands = [
            f"git clone --depth=50 {clone_url} /workspace/repo",
            "cd /workspace/repo",
            f"git checkout -b {branch} origin/{base_branch}",
            "pip install -e '.[dev]' 2>/dev/null || pip install -r requirements.txt 2>/dev/null || true",
        ]
        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm, " && ".join(commands), timeout=120
        )
        return StepResult(
            step=StepType.SETUP,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
        )

    async def _step_lint(self, vm: VM) -> StepResult:
        """Run linter (deterministic step)."""
        start = time.monotonic()
        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm,
            "cd /workspace/repo && ruff check --fix . && ruff format .",
            timeout=60,
        )
        return StepResult(
            step=StepType.LINT,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
        )

    async def _step_test(self, vm: VM) -> StepResult:
        """Run test suite (deterministic step)."""
        start = time.monotonic()
        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm,
            "cd /workspace/repo && python -m pytest -v --tb=short 2>&1",
            timeout=180,
        )

        # Parse test results
        metadata: dict[str, Any] = {"raw_output": stdout}
        passed_match = re.search(r"(\d+) passed", stdout)
        if passed_match:
            metadata["passed"] = int(passed_match.group(1))
        failed_match = re.search(r"(\d+) failed", stdout)
        if failed_match:
            metadata["failed"] = int(failed_match.group(1))

        return StepResult(
            step=StepType.TEST,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
            metadata=metadata,
        )

    async def _step_commit(self, vm: VM, task: Task, branch: str) -> StepResult:
        """Commit and push changes (deterministic step)."""
        start = time.monotonic()

        # Get changed files
        exit_code, diff_output, _ = await self.backend.exec_in_vm(
            vm, "cd /workspace/repo && git diff --name-only", timeout=10
        )
        files = [f.strip() for f in diff_output.strip().split("\n") if f.strip()]

        # Build commit message (escape single quotes for shell safety)
        desc_safe = task.description[:72].replace("'", "'\\''")
        desc_full_safe = task.description.replace("'", "'\\''")
        commit_msg = (
            f"fix: {desc_safe}\\n\\n"
            f"Automated fix by Duckling (autonomous coding agent).\\n\\n"
            f"Task: {desc_full_safe}\\n"
            f"Task ID: {task.id}\\n"
            f"Agent: {self.engine.name}\\n"
            f"Files changed: {len(files)}\\n\\n"
            f"Co-authored-by: Duckling <duckling@users.noreply.github.com>"
        )

        commands = [
            "cd /workspace/repo",
            "git add -A",
            f"git commit -m $'{commit_msg}'",
            f"git push -u origin {branch}",
            "git rev-parse HEAD",
        ]

        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm, " && ".join(commands), timeout=60
        )

        sha = stdout.strip().split("\n")[-1] if exit_code == 0 else ""

        return StepResult(
            step=StepType.COMMIT,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
            metadata={"sha": sha, "files": files},
        )

    # ── AI step implementations (delegated to engine) ──────────────────

    async def _step_analyze(self, task: Task) -> StepResult:
        """Have the AI agent analyze the codebase and understand the task."""
        start = time.monotonic()
        prompt = f"""You are an autonomous coding agent. Analyze this codebase and understand the following task:

TASK: {task.description}

Steps:
1. Read the project structure (find key files, understand architecture)
2. Identify the files most relevant to this task
3. Understand the testing framework and how tests are structured
4. Output a summary of your understanding

Use these commands to explore:
- find /workspace/repo -type f -name '*.py' | head -50
- cat /workspace/repo/README.md
- cat /workspace/repo/pyproject.toml || cat /workspace/repo/setup.py
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=180)
        return StepResult(
            step=StepType.ANALYZE,
            success=True,  # Analysis is best-effort
            output=output,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_plan(self, task: Task) -> StepResult:
        """Have the AI agent create an execution plan."""
        start = time.monotonic()
        prompt = f"Create a step-by-step plan to accomplish: {task.description}"
        success, output = await self.engine.execute_prompt(prompt, timeout=60)
        return StepResult(
            step=StepType.PLAN,
            success=True,
            output=output,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_code(self, task: Task) -> StepResult:
        """Have the AI agent write the actual code changes."""
        start = time.monotonic()
        prompt = f"""Implement the following task by modifying the codebase at /workspace/repo:

TASK: {task.description}

Requirements:
- Make minimal, focused changes
- Follow existing code style and patterns
- Add or update tests as needed
- Do NOT modify unrelated files
- Write clean, well-commented code

Make the changes now. Edit the files directly.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=300)
        return StepResult(
            step=StepType.CODE,
            success=success,
            output=output,
            error=output if not success else "",
            duration_seconds=time.monotonic() - start,
        )

    async def _step_repair(self, failure_type: str, failure_output: str) -> StepResult:
        """Have the AI agent self-repair based on lint/test failures."""
        start = time.monotonic()
        prompt = f"""The {failure_type} step failed. Here is the output:

{failure_output[:3000]}

Fix the issues. Make minimal changes to resolve the failures while preserving the intended behavior.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=180)
        return StepResult(
            step=StepType.REPAIR,
            success=True,  # Repair is best-effort, next lint/test will validate
            output=output,
            duration_seconds=time.monotonic() - start,
        )

    # ── Review-mode step implementations ──────────────────────────────

    async def _step_setup_review(self, vm: VM, clone_url: str, branch: str) -> StepResult:
        """Clone repo on the target branch (no working branch created)."""
        start = time.monotonic()
        commands = [
            f"git clone --depth=50 -b {branch} {clone_url} /workspace/repo",
        ]
        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm, " && ".join(commands), timeout=120
        )
        return StepResult(
            step=StepType.SETUP,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
        )

    # ══ New Review Pipeline: Deterministic Steps ══════════════════════════

    async def _step_file_inventory(self, vm: VM) -> StepResult:
        """Scan the repo, classify files by language, skip binaries/generated. (Deterministic)"""
        start = time.monotonic()
        from orchestrator.services.config import get_settings

        settings = get_settings()
        skip = settings.review_skip_patterns.split(",")
        skip_args = " ".join(f"--glob '!{p.strip()}'" for p in skip)

        # Use ripgrep to list all files (respects .gitignore by default)
        cmd = f"""cd /workspace/repo && {{
  echo '=== FILE LIST ==='
  rg --files {skip_args} 2>/dev/null | head -500
  echo ''
  echo '=== LANGUAGE BREAKDOWN ==='
  rg --files {skip_args} 2>/dev/null | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20
  echo ''
  echo '=== DIRECTORY STRUCTURE ==='
  find . -maxdepth 2 -type d ! -path './.git/*' ! -path '*/node_modules/*' ! -path '*/__pycache__/*' | sort | head -40
  echo ''
  echo '=== LARGE FILES (>500 lines) ==='
  rg --files {skip_args} 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -30
}}"""
        exit_code, stdout, stderr = await self.backend.exec_in_vm(vm, cmd, timeout=60)

        # Parse results for metadata
        lines = stdout.split("\n")
        all_files = []
        in_file_list = False
        for line in lines:
            if "=== FILE LIST ===" in line:
                in_file_list = True
                continue
            if line.startswith("==="):
                in_file_list = False
                continue
            if in_file_list and line.strip():
                all_files.append(line.strip())

        # Pick top files by size for detailed review
        max_files = settings.review_max_files
        top_files = all_files[:max_files]

        return StepResult(
            step=StepType.INVENTORY,
            success=True,
            output=stdout,
            duration_seconds=time.monotonic() - start,
            metadata={
                "total_files": len(all_files),
                "top_files": top_files,
                "all_files": all_files,
            },
        )

    async def _step_dependency_analysis(self, vm: VM) -> StepResult:
        """Parse dependency manifests — package.json, pyproject.toml, go.mod, etc. (Deterministic)"""
        start = time.monotonic()
        cmd = """cd /workspace/repo && {
  echo '=== PYTHON DEPENDENCIES ==='
  if [ -f pyproject.toml ]; then
    echo 'pyproject.toml found:'
    cat pyproject.toml 2>/dev/null | head -60
  elif [ -f requirements.txt ]; then
    echo 'requirements.txt found:'
    cat requirements.txt 2>/dev/null | head -40
  elif [ -f setup.py ]; then
    echo 'setup.py found'
  else
    echo 'No Python dependency file found'
  fi
  echo ''
  echo '=== NODE DEPENDENCIES ==='
  if [ -f package.json ]; then
    echo 'package.json found:'
    cat package.json | jq '{name, version, dependencies: (.dependencies // {} | keys), devDependencies: (.devDependencies // {} | keys)}' 2>/dev/null || cat package.json | head -40
  else
    echo 'No package.json found'
  fi
  echo ''
  echo '=== GO DEPENDENCIES ==='
  if [ -f go.mod ]; then
    echo 'go.mod found:'
    cat go.mod | head -30
  else
    echo 'No go.mod found'
  fi
  echo ''
  echo '=== RUST DEPENDENCIES ==='
  if [ -f Cargo.toml ]; then
    echo 'Cargo.toml found:'
    cat Cargo.toml | head -40
  else
    echo 'No Cargo.toml found'
  fi
  echo ''
  echo '=== DOCKER ==='
  ls -la Dockerfile* docker-compose* 2>/dev/null || echo 'No Docker files found'
  echo ''
  echo '=== CI/CD ==='
  ls -la .github/workflows/*.yml 2>/dev/null || echo 'No GitHub Actions found'
  ls -la .gitlab-ci.yml 2>/dev/null || echo 'No GitLab CI found'
  ls -la Jenkinsfile 2>/dev/null || echo 'No Jenkinsfile found'
}"""
        exit_code, stdout, stderr = await self.backend.exec_in_vm(vm, cmd, timeout=30)
        return StepResult(
            step=StepType.DEPS,
            success=True,
            output=stdout,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_code_metrics(self, vm: VM) -> StepResult:
        """Run tokei for code statistics, ruff for Python quality. (Deterministic)"""
        start = time.monotonic()
        cmd = """cd /workspace/repo && {
  echo '=== CODE STATISTICS (scc) ==='
  scc --sort code 2>/dev/null || echo 'scc not available'
  echo ''
  echo '=== PYTHON LINT SUMMARY (ruff) ==='
  ruff check --statistics . 2>/dev/null | head -30 || echo 'No Python files or ruff not applicable'
  echo ''
  echo '=== TEST FILES ==='
  find . -type f \\( -name 'test_*.py' -o -name '*_test.py' -o -name '*.test.ts' -o -name '*.test.js' -o -name '*.spec.ts' -o -name '*.spec.js' -o -name '*_test.go' \\) ! -path '*/node_modules/*' 2>/dev/null | head -30
  echo ''
  echo '=== README ==='
  if [ -f README.md ]; then
    echo 'README.md exists ('$(wc -l < README.md)' lines)'
  elif [ -f README.rst ]; then
    echo 'README.rst exists'
  else
    echo 'No README found'
  fi
}"""
        exit_code, stdout, stderr = await self.backend.exec_in_vm(vm, cmd, timeout=60)
        return StepResult(
            step=StepType.METRICS,
            success=True,
            output=stdout,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_ast_security_scan(self, vm: VM) -> StepResult:
        """Run ast-grep with security rules against the codebase. (Deterministic)"""
        start = time.monotonic()
        from orchestrator.services.config import get_settings

        settings = get_settings()
        rules_dir = settings.review_ast_grep_rules

        cmd = f"""cd /workspace/repo && {{
  echo '=== AST SECURITY SCAN ==='
  if command -v sg >/dev/null 2>&1; then
    FINDINGS=0
    for rule in {rules_dir}/*.yml; do
      if [ -f "$rule" ]; then
        RESULT=$(sg scan --rule "$rule" . 2>/dev/null)
        if [ -n "$RESULT" ]; then
          RULE_NAME=$(basename "$rule" .yml)
          echo "--- $RULE_NAME ---"
          echo "$RESULT" | head -30
          echo ""
          COUNT=$(echo "$RESULT" | grep -c "^" || true)
          FINDINGS=$((FINDINGS + COUNT))
        fi
      fi
    done
    echo "Total findings: $FINDINGS"
  else
    echo 'ast-grep (sg) not available, skipping AST scan'
  fi
  echo ''
  echo '=== PYTHON SECURITY (bandit) ==='
  bandit -r . -f txt --severity-level medium -q 2>/dev/null | head -50 || echo 'bandit not available or no Python files'
}}"""
        exit_code, stdout, stderr = await self.backend.exec_in_vm(vm, cmd, timeout=90)

        # Parse findings count
        findings_count = 0
        for line in stdout.split("\n"):
            if "Total findings:" in line:
                try:
                    findings_count = int(line.split(":")[-1].strip())
                except ValueError:
                    pass

        return StepResult(
            step=StepType.SECURITY,
            success=True,
            output=stdout,
            duration_seconds=time.monotonic() - start,
            metadata={"findings_count": findings_count},
        )

    async def _step_git_stats(self, vm: VM) -> StepResult:
        """Analyze git history for commit patterns, hotspots, contributors. (Deterministic)"""
        start = time.monotonic()
        cmd = """cd /workspace/repo && {
  echo '=== RECENT COMMITS (last 20) ==='
  git log --oneline -20 2>/dev/null || echo 'No git history'
  echo ''
  echo '=== CONTRIBUTORS ==='
  git shortlog -sn --no-merges 2>/dev/null | head -10 || echo 'No contributors found'
  echo ''
  echo '=== FILE HOTSPOTS (most changed files) ==='
  git log --pretty=format: --name-only -50 2>/dev/null | sort | uniq -c | sort -rn | head -15 || echo 'No history'
  echo ''
  echo '=== COMMIT FREQUENCY ==='
  git log --format='%aI' -100 2>/dev/null | cut -d'T' -f1 | uniq -c | tail -10 || echo 'No history'
  echo ''
  echo '=== BRANCH INFO ==='
  git branch -a 2>/dev/null | head -10 || echo 'No branches'
}"""
        exit_code, stdout, stderr = await self.backend.exec_in_vm(vm, cmd, timeout=30)
        return StepResult(
            step=StepType.ANALYZE,
            success=True,
            output=stdout,
            duration_seconds=time.monotonic() - start,
        )

    def _build_review_context(
        self,
        inventory: StepResult,
        deps: StepResult,
        metrics: StepResult,
        security: StepResult,
    ) -> str:
        """Assemble the deterministic pre-processing results into a context string for the LLM."""
        return f"""=== PRE-PROCESSED CODEBASE ANALYSIS ===

{inventory.output}

{deps.output}

{metrics.output}

{security.output}
"""

    # ══ New Review Pipeline: AI Steps ═════════════════════════════════════

    async def _step_file_level_review(
        self, task: Task, vm: VM, pre_context: str, top_files: list[str]
    ) -> StepResult:
        """AI reviews the most important files individually, with full pre-processed context."""
        start = time.monotonic()

        # Read file contents from the VM for the top files (batch read)
        file_contents: list[str] = []
        for fpath in top_files[:15]:  # Cap at 15 files to fit context
            _, content, _ = await self.backend.exec_in_vm(
                vm,
                f"head -300 '/workspace/repo/{fpath}' 2>/dev/null || echo '[file not readable]'",
                timeout=10,
            )
            if content.strip() and content.strip() != "[file not readable]":
                file_contents.append(f"### {fpath}\n```\n{content[:3000]}\n```\n")

        files_text = "\n".join(file_contents) if file_contents else "(no files to review)"

        prompt = f"""You are a senior code reviewer performing a thorough, structured review.

The codebase has been pre-analyzed. Here is the deterministic analysis:

{pre_context[:8000]}

And here are the key source files to review:

{files_text[:12000]}

USER'S REVIEW REQUEST: {task.description}

For each file reviewed, identify:
1. **Bugs**: Logic errors, off-by-ones, null handling, race conditions, resource leaks
2. **Security**: Injection, auth bypass, data exposure, input validation, hardcoded secrets
3. **Code Quality**: Naming, readability, DRY violations, dead code, excessive complexity
4. **Design**: Is the approach sound? Are there simpler alternatives? Is it maintainable?
5. **Testing gaps**: What's untested? What edge cases are missing?

Be specific — cite file paths and line ranges. Don't be vague.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=300)
        return StepResult(
            step=StepType.FILE_REVIEW,
            success=True,
            output=output,
            duration_seconds=time.monotonic() - start,
            metadata={"files_reviewed": len(file_contents)},
        )

    async def _step_cross_file_synthesis(
        self, task: Task, pre_context: str, file_reviews: str
    ) -> StepResult:
        """AI synthesizes cross-cutting concerns across the entire codebase."""
        start = time.monotonic()
        prompt = f"""Based on the pre-processed codebase analysis and your file-level review, now analyze cross-cutting concerns:

PRE-PROCESSED ANALYSIS (summary):
{pre_context[:4000]}

YOUR FILE-LEVEL REVIEW:
{file_reviews[:6000]}

Analyze these cross-cutting dimensions:
1. **Architecture**: Is the codebase well-organized? Are concerns separated? Is there a clear pattern (MVC, hexagonal, etc.)?
2. **Error Handling**: Is error handling consistent? Are errors logged properly? Are there silent failures?
3. **Consistency**: Are naming conventions consistent? Are similar problems solved the same way?
4. **Dependencies**: Are deps up-to-date? Are there unnecessary or duplicate deps? Are versions pinned?
5. **Performance**: Any obvious N+1 queries, memory leaks, blocking calls in async code, missing caching?
6. **Documentation**: Is the codebase documented? Are complex functions explained? Is there an architecture doc?
7. **Testing Strategy**: What's the testing approach? Unit vs integration? What's the coverage like?

Provide a concise analysis for each dimension.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=180)
        return StepResult(
            step=StepType.SYNTHESIS,
            success=True,
            output=output,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_generate_report(
        self,
        task: Task,
        pre_context: str,
        file_reviews: str,
        synthesis: str,
        security_output: str,
    ) -> StepResult:
        """Generate the final structured review report."""
        start = time.monotonic()
        prompt = f"""Generate a structured code review report. This is the final deliverable the user will see.

ORIGINAL REQUEST: {task.description}

DETERMINISTIC ANALYSIS:
{pre_context[:3000]}

FILE-LEVEL REVIEW:
{file_reviews[:4000]}

CROSS-FILE SYNTHESIS:
{synthesis[:3000]}

SECURITY SCAN RESULTS:
{security_output[:2000]}

Format your report EXACTLY as follows:

## Summary
2-3 sentences: what this project is, overall health assessment, and a letter grade (A-F).

## Architecture
Brief description of the codebase structure and patterns used.

## Issues Found
List each issue with severity. Format:
- **[CRITICAL]** `file:line` — Description and suggested fix
- **[WARNING]** `file:line` — Description and suggested fix  
- **[SUGGESTION]** `file:line` — Description

Group by severity (CRITICAL first, then WARNING, then SUGGESTION).

## Security Assessment
Summary of security findings from the AST scan and your review.

## Testing Assessment
What's the test coverage like? What's missing?

## Dependencies
Are they healthy? Outdated? Unnecessary?

## What Looks Good
Highlight positive patterns and well-written code.

## Recommendations
Top 3-5 prioritized actions to improve this codebase.

Be specific, actionable, and constructive. Reference actual code.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=180)
        return StepResult(
            step=StepType.REPORT,
            success=success,
            output=output,
            error=output if not success else "",
            duration_seconds=time.monotonic() - start,
        )

    # ── Peer-review step implementations ─────────────────────────────

    async def _step_setup_peer_review(
        self,
        vm: VM,
        clone_url: str,
        base_branch: str,
        target_branch: str,
    ) -> StepResult:
        """Clone repo and checkout the target branch for peer review."""
        start = time.monotonic()
        commands = [
            f"git clone {clone_url} /workspace/repo",
            "cd /workspace/repo",
            f"git checkout {target_branch}",
        ]
        exit_code, stdout, stderr = await self.backend.exec_in_vm(
            vm,
            " && ".join(commands),
            timeout=120,
        )
        return StepResult(
            step=StepType.SETUP,
            success=exit_code == 0,
            output=stdout,
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
        )

    async def _step_get_diff(
        self,
        vm: VM,
        base_branch: str,
        target_branch: str,
    ) -> StepResult:
        """Get the diff between base and target branch (deterministic)."""
        start = time.monotonic()

        # Get diff stats
        _, stats_out, _ = await self.backend.exec_in_vm(
            vm,
            f"cd /workspace/repo && git diff --stat origin/{base_branch}..{target_branch}",
            timeout=30,
        )

        # Get changed file list
        _, files_out, _ = await self.backend.exec_in_vm(
            vm,
            f"cd /workspace/repo && git diff --name-only origin/{base_branch}..{target_branch}",
            timeout=30,
        )
        files = [f.strip() for f in files_out.strip().split("\n") if f.strip()]

        # Get the actual diff (truncate to 15k chars to fit in LLM context)
        exit_code, diff_out, stderr = await self.backend.exec_in_vm(
            vm,
            f"cd /workspace/repo && git diff origin/{base_branch}..{target_branch}",
            timeout=30,
        )

        return StepResult(
            step=StepType.ANALYZE,
            success=exit_code == 0,
            output=diff_out[:15000],
            error=stderr if exit_code != 0 else "",
            duration_seconds=time.monotonic() - start,
            metadata={
                "stats": stats_out.strip().split("\n")[-1] if stats_out.strip() else "",
                "files": files,
            },
        )

    async def _step_peer_review(self, task: Task, diff: str) -> StepResult:
        """Have the AI agent review the code diff."""
        start = time.monotonic()
        prompt = f"""You are a senior engineer performing a code review. Your coworker has pushed changes to branch '{task.target_branch}' (compared against '{task.branch}').

USER'S REVIEW REQUEST: {task.description}

Here is the diff:

```diff
{diff}
```

Perform a thorough code review. For each file changed:
1. **Understand** what the change does
2. **Check for bugs**: logic errors, off-by-ones, null/undefined handling, race conditions
3. **Check for security**: injection, auth bypass, data exposure, input validation
4. **Check style**: naming, readability, consistency with surrounding code
5. **Check design**: is the approach good? are there simpler alternatives?
6. **Check tests**: are the changes tested? are edge cases covered?

Also read the actual files for context — the diff alone may not show the full picture.
Use commands like `cat /workspace/repo/<file>` to see the full file context around changes.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=300)
        return StepResult(
            step=StepType.ANALYZE,
            success=True,
            output=output,
            duration_seconds=time.monotonic() - start,
        )

    async def _step_peer_review_feedback(self, task: Task) -> StepResult:
        """Generate structured peer review feedback."""
        start = time.monotonic()
        prompt = f"""Based on your review, provide structured feedback the developer can act on.

Format your response as:

## Summary
One paragraph overview of the changes and your overall impression.

## Issues Found
For each issue:
- **[SEVERITY]** `file:line` — Description of the issue and suggested fix

Severity levels: CRITICAL (must fix), WARNING (should fix), SUGGESTION (nice to have)

## What Looks Good
Highlight things done well — good patterns, clean code, proper testing.

## Recommendations
High-level suggestions for the branch before merging.

Be constructive, specific, and actionable. Reference actual code when possible.
"""
        success, output = await self.engine.execute_prompt(prompt, timeout=180)
        return StepResult(
            step=StepType.ANALYZE,
            success=success,
            output=output,
            error=output if not success else "",
            duration_seconds=time.monotonic() - start,
        )

    async def _notify(self, step_result: StepResult):
        """Notify listeners of step completion (for real-time UI updates)."""
        if self.on_step_complete:
            try:
                await self.on_step_complete(step_result)
            except Exception as e:
                await logger.awarning(
                    "Step notification callback failed",
                    step=step_result.step,
                    error=str(e),
                )
