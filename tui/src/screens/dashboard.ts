/**
 * Dashboard screen — the home view.
 *
 * Compact layout:
 *   ┌──────────── DUCKLING (ASCIIFont) ───────────┐
 *   │       Autonomous Coding Agent Platform       │
 *   ╭─ Pool Status ──────────────────────────────╮
 *   │ ╭──────╮ ╭──────╮ ╭──────╮ ╭────────────╮ │
 *   │ │  17  │ │   0  │ │  17  │ │  0.1ms     │ │
 *   │ │ WARM │ │ BUSY │ │TOTAL │ │ LATENCY    │ │
 *   │ ╰──────╯ ╰──────╯ ╰──────╯ ╰────────────╯ │
 *   ╰────────────────────────────────────────────╯
 *   ╭─ Recent Tasks (3) ─────────────────────────╮
 *   │ [*] completed  review  description...  21m │
 *   │ [x] failed     code    Fix the...      10h │
 *   ╰────────────────────────────────────────────╯
 */

import {
  BoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";
import { theme, statusColor, statusIcon } from "../theme.js";
import { addAll, removeAllChildren } from "../util.js";
import type { DucklingAPI, TaskResponse, PoolStats } from "../api.js";

export class DashboardScreen {
  private renderer: CliRenderer;
  private api: DucklingAPI;
  container: BoxRenderable;
  private statsContainer: BoxRenderable;
  private taskListContainer: BoxRenderable;
  private tasksBox: BoxRenderable;
  private errorText: TextRenderable;
  private taskCountText: string = "0";
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(renderer: CliRenderer, api: DucklingAPI) {
    this.renderer = renderer;
    this.api = api;

    // ── Root ───────────────────────────────────────────────
    this.container = new BoxRenderable(renderer, {
      id: "dashboard",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      paddingX: 2,
      paddingTop: 1,
      paddingBottom: 0,
      gap: 1,
    });

    // ── Logo (hand-drawn ASCII art) ─────────────────────
    // Each backslash must be doubled in JS strings.
    const LOGO = [
      "    ____             __   ___            ",
      "   / __ \\__  _______/ /__/ (_)___  ____ _",
      "  / / / / / / / ___/ //_/ / / __ \\/ __ `/",
      " / /_/ / /_/ / /__/ ,< / / / / / / /_/ / ",
      "/_____/\\__,_/\\___/_/|_/_/_/_/ /_/\\__, /  ",
      "                                /____/   ",
    ];

    const logoRow = new BoxRenderable(renderer, {
      id: "dash-logo-row",
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
    });

    for (let i = 0; i < LOGO.length; i++) {
      logoRow.add(
        new TextRenderable(renderer, {
          id: `logo-${i}`,
          content: LOGO[i],
          fg: theme.cyan,
        }),
      );
    }
    logoRow.add(
      new TextRenderable(renderer, {
        id: "dash-subtitle",
        content: "Autonomous Coding Agent Platform",
        fg: theme.fgDim,
      }),
    );

    this.errorText = new TextRenderable(renderer, {
      id: "dash-error",
      content: "",
      fg: theme.error,
    });

    // ── Pool Status panel ─────────────────────────────────
    const statsBox = new BoxRenderable(renderer, {
      id: "dash-stats-box",
      flexDirection: "column",
      width: "100%",
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Pool Status ",
      titleAlignment: "left",
      paddingX: 1,
      paddingY: 0,
    });

    this.statsContainer = new BoxRenderable(renderer, {
      id: "dash-stats",
      flexDirection: "row",
      gap: 1,
      width: "100%",
    });
    statsBox.add(this.statsContainer);

    // ── Recent Tasks panel ────────────────────────────────
    this.tasksBox = new BoxRenderable(renderer, {
      id: "dash-tasks-box",
      flexDirection: "column",
      width: "100%",
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Recent Tasks ",
      titleAlignment: "left",
      paddingX: 1,
      paddingTop: 1,
      paddingBottom: 1,
    });

    this.taskListContainer = new BoxRenderable(renderer, {
      id: "dash-tasks",
      flexDirection: "column",
      width: "100%",
      gap: 0,
    });
    this.tasksBox.add(this.taskListContainer);

    // ── Assemble ──────────────────────────────────────────
    addAll(
      this.container,
      logoRow,
      this.errorText,
      statsBox,
      this.tasksBox,
    );
  }

  startPolling() {
    this.refresh();
    this.pollingTimer = setInterval(() => this.refresh(), 3000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async refresh() {
    try {
      const [health, taskList] = await Promise.all([
        this.api.getHealth().catch(() => null),
        this.api.listTasks(1, 10).catch(() => null),
      ]);

      this.errorText.content = "";
      this.renderStats(health?.pool ?? null);
      this.renderTasks(taskList?.tasks ?? []);
    } catch (err: any) {
      this.errorText.content = `Error: ${err.message}`;
    }
  }

  // ── Pool Stats ──────────────────────────────────────────

  private renderStats(pool: PoolStats | null) {
    removeAllChildren(this.statsContainer);

    if (!pool) {
      this.statsContainer.add(
        new TextRenderable(this.renderer, {
          id: "dash-stats-offline",
          content: "Orchestrator not connected",
          fg: theme.fgDim,
        }),
      );
      return;
    }

    const cards: { label: string; value: string; color: string }[] = [
      { label: "WARM", value: String(pool.ready_vms ?? 0), color: theme.green },
      { label: "BUSY", value: String(pool.claimed_vms ?? 0), color: theme.yellow },
      { label: "TOTAL", value: String(pool.total_vms ?? 0), color: theme.cyan },
      { label: "LATENCY", value: `${(pool.avg_claim_time_ms ?? 0).toFixed(1)}ms`, color: theme.magenta },
    ];

    for (const card of cards) {
      const box = new BoxRenderable(this.renderer, {
        id: `stat-${card.label}`,
        borderStyle: "rounded",
        borderColor: theme.borderDim,
        paddingX: 2,
        width: 16,
        height: 4,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      });
      addAll(box,
        new TextRenderable(this.renderer, {
          id: `sv-${card.label}`,
          content: card.value || "--",
          fg: card.color,
        }),
        new TextRenderable(this.renderer, {
          id: `sl-${card.label}`,
          content: card.label,
          fg: theme.fgDim,
        }),
      );
      this.statsContainer.add(box);
    }
  }

  // ── Recent Tasks ────────────────────────────────────────

  private renderTasks(tasks: TaskResponse[]) {
    removeAllChildren(this.taskListContainer);

    // Update title with count
    this.tasksBox.title = ` Recent Tasks (${tasks.length}) `;

    if (tasks.length === 0) {
      this.taskListContainer.add(
        new TextRenderable(this.renderer, {
          id: "dash-empty-text",
          content: "No tasks yet. Press [2] to submit a new task.",
          fg: theme.fgDim,
        }),
      );
      return;
    }

    // Column header
    const header = new BoxRenderable(this.renderer, {
      id: "dash-task-hdr",
      flexDirection: "row",
      width: "100%",
      height: 1,
      gap: 1,
      marginBottom: 0,
    });
    addAll(header,
      new TextRenderable(this.renderer, {
        id: "dh-ic",
        content: "   ",
        fg: theme.fgMuted,
      }),
      new TextRenderable(this.renderer, {
        id: "dh-st",
        content: "STATUS      ",
        fg: theme.fgMuted,
      }),
      new TextRenderable(this.renderer, {
        id: "dh-md",
        content: "MODE    ",
        fg: theme.fgMuted,
      }),
      new TextRenderable(this.renderer, {
        id: "dh-ds",
        content: "DESCRIPTION",
        fg: theme.fgMuted,
      }),
    );
    this.taskListContainer.add(header);

    // Task rows
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const sColor = statusColor(task.status);
      const sIcon = statusIcon(task.status);
      const desc =
        task.description.length > 50
          ? task.description.slice(0, 47) + "..."
          : task.description;
      const ago = timeAgo(task.created_at);

      const row = new BoxRenderable(this.renderer, {
        id: `dt-${i}`,
        flexDirection: "row",
        width: "100%",
        height: 1,
        gap: 1,
        backgroundColor: i % 2 === 0 ? theme.bgDark : undefined,
      });
      addAll(row,
        new TextRenderable(this.renderer, {
          id: `di-${i}`,
          content: `[${sIcon}]`,
          fg: sColor,
        }),
        new TextRenderable(this.renderer, {
          id: `ds-${i}`,
          content: task.status.padEnd(12),
          fg: sColor,
        }),
        new TextRenderable(this.renderer, {
          id: `dm-${i}`,
          content: task.mode.padEnd(8),
          fg: theme.fgDim,
        }),
        new TextRenderable(this.renderer, {
          id: `dd-${i}`,
          content: desc,
          fg: theme.fg,
        }),
        new TextRenderable(this.renderer, {
          id: `da-${i}`,
          content: ago,
          fg: theme.fgMuted,
        }),
      );
      this.taskListContainer.add(row);
    }

    // Hint at the bottom
    this.taskListContainer.add(
      new TextRenderable(this.renderer, {
        id: "dash-hint",
        content: "Press [3] to see all tasks  |  [2] to submit a new one",
        fg: theme.fgMuted,
      }),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
