/**
 * Task Detail screen — live view of a single task.
 *
 * Structured panel layout:
 *   ┌─ Task Info ─────────────┐  ┌─ Pipeline ────────────────┐
 *   │ ID:     ...              │  │ [*] SETUP                 │
 *   │ Status: completed        │  │ [*] FILE_INVENTORY        │
 *   │ ...                      │  │ ...                       │
 *   └─────────────────────────┘  └────────────────────────────┘
 *   ┌─ Agent Log ─────────────────────────────────────────────┐
 *   │ scrollable log content...                            [▼]│
 *   └─────────────────────────────────────────────────────────┘
 *   ┌─ Review Report ─────────────────────────────────────────┐
 *   │ review output...                                        │
 *   └─────────────────────────────────────────────────────────┘
 */

import {
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
  type CliRenderer,
} from "@opentui/core";
import { theme, statusColor } from "../theme.js";
import { addAll, removeAllChildren } from "../util.js";
import type { DucklingAPI, TaskResponse } from "../api.js";

// ── Pipeline steps ───────────────────────────────────────────────

const REVIEW_STEPS = [
  "SETUP",
  "FILE_INVENTORY",
  "DEPENDENCY_ANALYSIS",
  "CODE_METRICS",
  "AST_SECURITY_SCAN",
  "FILE_LEVEL_REVIEW",
  "CROSS_FILE_SYNTHESIS",
  "REPORT_GENERATION",
  "GIT_STATS",
];

const CODE_STEPS = [
  "CLONE",
  "BRANCH",
  "GENERATE_CODE",
  "LINT",
  "TEST",
  "FIX_LOOP",
  "COMMIT",
  "PUSH",
];

export class TaskDetailScreen {
  private renderer: CliRenderer;
  private api: DucklingAPI;
  container: BoxRenderable;

  // Panel internals
  private metaContent: BoxRenderable;
  private stepsContent: BoxRenderable;
  private logScrollBox: ScrollBoxRenderable;
  private logContent: BoxRenderable;
  private reviewBox: BoxRenderable;
  private reviewContent: BoxRenderable;
  private errorText: TextRenderable;

  // State
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private taskId: string | null = null;
  private currentTask: TaskResponse | null = null;
  private lastLogLength = 0;
  private logLineCount = 0;
  private reviewRendered = false;

  constructor(renderer: CliRenderer, api: DucklingAPI) {
    this.renderer = renderer;
    this.api = api;

    // ── Root container ────────────────────────────────────────
    this.container = new BoxRenderable(renderer, {
      id: "task-detail",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      paddingX: 2,
      paddingTop: 1,
      paddingBottom: 0,
      gap: 1,
    });

    // ── Title bar ─────────────────────────────────────────────
    const titleBar = new BoxRenderable(renderer, {
      id: "td-titlebar",
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      height: 1,
    });
    addAll(titleBar,
      new TextRenderable(renderer, {
        id: "td-title",
        content: "Task Detail",
        fg: theme.fg,
      }),
      new TextRenderable(renderer, {
        id: "td-back",
        content: "[Esc] Back to list",
        fg: theme.fgDim,
      }),
    );

    this.errorText = new TextRenderable(renderer, {
      id: "td-error",
      content: "",
      fg: theme.error,
    });

    // ── Top row: Task Info (left) + Pipeline (right) ──────────
    const topRow = new BoxRenderable(renderer, {
      id: "td-top-row",
      flexDirection: "row",
      width: "100%",
      gap: 1,
    });

    // -- Task Info panel (left) --
    const metaBox = new BoxRenderable(renderer, {
      id: "td-meta-box",
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Task Info ",
      titleAlignment: "left",
      padding: 1,
      gap: 0,
    });

    this.metaContent = new BoxRenderable(renderer, {
      id: "td-meta-content",
      flexDirection: "column",
      width: "100%",
      gap: 0,
    });
    metaBox.add(this.metaContent);

    // -- Pipeline panel (right) --
    const stepsBox = new BoxRenderable(renderer, {
      id: "td-steps-box",
      flexDirection: "column",
      width: 32,
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Pipeline ",
      titleAlignment: "left",
      padding: 1,
      gap: 0,
    });

    this.stepsContent = new BoxRenderable(renderer, {
      id: "td-steps-content",
      flexDirection: "column",
      width: "100%",
      gap: 0,
    });
    stepsBox.add(this.stepsContent);

    addAll(topRow, metaBox, stepsBox);

    // ── Agent Log panel ───────────────────────────────────────
    const logBox = new BoxRenderable(renderer, {
      id: "td-log-box",
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Agent Log ",
      titleAlignment: "left",
    });

    this.logContent = new BoxRenderable(renderer, {
      id: "td-log-content",
      flexDirection: "column",
      width: "100%",
    });

    this.logScrollBox = new ScrollBoxRenderable(renderer, {
      id: "td-log-scroll",
      width: "100%",
      height: 12,
      stickyScroll: true,
      stickyStart: "bottom",
      viewportCulling: true,
      rootOptions: { backgroundColor: theme.bgDark },
      viewportOptions: { backgroundColor: theme.bgDark },
    });

    this.logScrollBox.add(this.logContent);
    logBox.add(this.logScrollBox);

    // ── Review Report panel (hidden initially) ────────────────
    this.reviewContent = new BoxRenderable(renderer, {
      id: "td-review-content",
      flexDirection: "column",
      width: "100%",
    });

    const reviewScroll = new ScrollBoxRenderable(renderer, {
      id: "td-review-scroll",
      width: "100%",
      height: 10,
      stickyScroll: false,
      viewportCulling: true,
      rootOptions: { backgroundColor: theme.bgDark },
      viewportOptions: { backgroundColor: theme.bgDark },
    });
    reviewScroll.add(this.reviewContent);

    this.reviewBox = new BoxRenderable(renderer, {
      id: "td-review-box",
      flexDirection: "column",
      width: "100%",
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Review Report ",
      titleAlignment: "left",
      visible: false,
    });
    this.reviewBox.add(reviewScroll);

    // ── Help bar ──────────────────────────────────────────────
    const helpBar = new TextRenderable(renderer, {
      id: "td-help",
      content: "Esc: back  |  PgUp/PgDn: scroll log  |  Auto-refreshing every 1.5s",
      fg: theme.fgMuted,
    });

    // ── Assemble ──────────────────────────────────────────────
    addAll(this.container,
      titleBar,
      this.errorText,
      topRow,
      logBox,
      this.reviewBox,
      helpBar,
    );
  }

  // ── Public API ──────────────────────────────────────────────

  focus() {
    this.logScrollBox.focus();
  }

  setTask(taskId: string) {
    this.taskId = taskId;
    this.lastLogLength = 0;
    this.logLineCount = 0;
    this.reviewRendered = false;
    removeAllChildren(this.logContent);
    removeAllChildren(this.reviewContent);
    this.reviewBox.visible = false;
    this.refresh();
  }

  startPolling() {
    if (this.taskId) {
      this.refresh();
    }
    this.pollingTimer = setInterval(() => {
      if (this.taskId) this.refresh();
    }, 1500);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // ── Data refresh ────────────────────────────────────────────

  private async refresh() {
    if (!this.taskId) return;

    try {
      const [task, logRes] = await Promise.all([
        this.api.getTask(this.taskId),
        this.api.getTaskLog(this.taskId).catch(() => null),
      ]);

      this.currentTask = task;
      this.errorText.content = "";
      this.renderMeta(task);
      this.renderSteps(task);

      if (logRes && logRes.log.length > this.lastLogLength) {
        this.appendLog(logRes.log.slice(this.lastLogLength));
        this.lastLogLength = logRes.log.length;
      }

      if (task.review_output && task.status === "completed" && !this.reviewRendered) {
        this.renderReview(task.review_output);
        this.reviewRendered = true;
      }
    } catch (err: any) {
      this.errorText.content = `Error: ${err.message}`;
    }
  }

  // ── Render: Task Info panel ─────────────────────────────────

  private renderMeta(task: TaskResponse) {
    removeAllChildren(this.metaContent);

    const sColor = statusColor(task.status);

    const fields: [string, string, string][] = [
      ["ID", task.id.slice(0, 20) + "...", theme.fgDim],
      ["Status", task.status.toUpperCase(), sColor],
      ["Mode", task.mode, theme.cyan],
      ["Repo", truncate(task.repo_url, 45), theme.fg],
      ["Branch", task.branch, theme.fg],
      ["Task", truncate(task.description, 45), theme.fg],
    ];

    if (task.duration_seconds != null) {
      fields.push(["Duration", `${task.duration_seconds.toFixed(1)}s`, theme.green]);
    }
    if (task.error_message) {
      fields.push(["Error", truncate(task.error_message, 45), theme.error]);
    }
    if (task.pr_url) {
      fields.push(["PR", task.pr_url, theme.cyan]);
    }
    if (task.intent_reason) {
      fields.push(["Intent", truncate(task.intent_reason, 45), theme.fgDim]);
    }

    let idx = 0;
    for (const [label, value, color] of fields) {
      const row = new BoxRenderable(this.renderer, {
        id: `mi-r-${idx}`,
        flexDirection: "row",
        height: 1,
        width: "100%",
      });
      addAll(row,
        new TextRenderable(this.renderer, {
          id: `mi-l-${idx}`,
          content: `${label}:`.padEnd(12),
          fg: theme.fgDim,
        }),
        new TextRenderable(this.renderer, {
          id: `mi-v-${idx}`,
          content: value,
          fg: color,
        }),
      );
      this.metaContent.add(row);
      idx++;
    }
  }

  // ── Render: Pipeline steps panel ────────────────────────────

  private renderSteps(task: TaskResponse) {
    removeAllChildren(this.stepsContent);

    const steps =
      task.mode === "review" || task.mode === "peer_review"
        ? REVIEW_STEPS
        : CODE_STEPS;

    // Determine which step we're on
    let activeStep = 0;
    if (task.status === "completed") {
      activeStep = steps.length;
    } else if (task.status === "failed") {
      // Show progress up to failure
      activeStep = Math.min(
        Math.floor(
          (task.iterations_used / (task.mode === "review" ? 9 : 8)) *
            steps.length,
        ),
        steps.length - 1,
      );
    } else if (task.status === "running" || task.status === "testing") {
      activeStep = Math.min(
        Math.floor(
          (task.iterations_used / (task.mode === "review" ? 9 : 8)) *
            steps.length,
        ),
        steps.length - 1,
      );
    }

    for (let i = 0; i < steps.length; i++) {
      let stepColor: string;
      let marker: string;

      if (task.status === "failed") {
        if (i < activeStep) {
          stepColor = theme.green;
          marker = "*";
        } else if (i === activeStep) {
          stepColor = theme.error;
          marker = "x";
        } else {
          stepColor = theme.fgMuted;
          marker = " ";
        }
      } else if (i < activeStep) {
        stepColor = theme.green;
        marker = "*";
      } else if (
        i === activeStep &&
        (task.status === "running" || task.status === "testing")
      ) {
        stepColor = theme.yellow;
        marker = ">";
      } else if (i < activeStep) {
        stepColor = theme.green;
        marker = "*";
      } else {
        stepColor = theme.fgMuted;
        marker = " ";
      }

      // Numbered step, one per line:  1. [*] SETUP
      const num = String(i + 1).padStart(2, " ");
      const stepName = steps[i].replace(/_/g, " ");

      this.stepsContent.add(
        new TextRenderable(this.renderer, {
          id: `st-${i}`,
          content: `${num}. [${marker}] ${stepName}`,
          fg: stepColor,
        }),
      );
    }
  }

  // ── Render: Agent Log (append-only) ─────────────────────────

  private appendLog(newText: string) {
    const lines = newText.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      let color: string = theme.fg;
      const lower = line.toLowerCase();
      if (lower.includes("error")) {
        color = theme.error;
      } else if (lower.includes("warn")) {
        color = theme.warning;
      } else if (
        line.startsWith(">>>") ||
        line.startsWith("STEP") ||
        line.startsWith("---")
      ) {
        color = theme.accent;
      } else if (line.startsWith("===") || line.startsWith("##")) {
        color = theme.cyan;
      } else if (line.startsWith("  ")) {
        // Indented content — dimmer
        color = theme.fgDim;
      }

      this.logContent.add(
        new TextRenderable(this.renderer, {
          id: `lg-${this.logLineCount++}`,
          content: line,
          fg: color,
        }),
      );
    }
  }

  // ── Render: Review Report panel ─────────────────────────────

  private renderReview(output: string) {
    removeAllChildren(this.reviewContent);
    this.reviewBox.visible = true;

    const lines = output.split("\n");
    let idx = 0;
    for (const line of lines) {
      let color: string = theme.fg;
      if (line.startsWith("#") || line.startsWith("===")) {
        color = theme.cyan;
      } else if (line.startsWith("-") || line.startsWith("*")) {
        color = theme.fgDim;
      } else if (
        line.includes("Grade:") ||
        line.includes("Score:") ||
        line.includes("Rating:")
      ) {
        color = theme.yellow;
      } else if (line.includes("CRITICAL") || line.includes("HIGH")) {
        color = theme.error;
      } else if (line.includes("MEDIUM")) {
        color = theme.warning;
      } else if (line.includes("LOW") || line.includes("INFO")) {
        color = theme.info;
      }

      this.reviewContent.add(
        new TextRenderable(this.renderer, {
          id: `rv-${idx++}`,
          content: line,
          fg: color,
        }),
      );
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}
