/**
 * Task List screen — scrollable list of all tasks with status badges.
 */

import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type CliRenderer,
} from "@opentui/core";
import { theme, statusColor, statusIcon, priorityColor } from "../theme.js";
import { addAll, removeAllChildren } from "../util.js";
import type { DucklingAPI, TaskResponse } from "../api.js";

export type TaskSelectCallback = (task: TaskResponse) => void;

export class TaskListScreen {
  private renderer: CliRenderer;
  private api: DucklingAPI;
  container: BoxRenderable;
  private taskSelect: SelectRenderable;
  private detailPanel: BoxRenderable;
  private statusSummary: TextRenderable;
  private errorText: TextRenderable;
  private tasks: TaskResponse[] = [];
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private onTaskSelectCb: TaskSelectCallback | null = null;

  constructor(renderer: CliRenderer, api: DucklingAPI) {
    this.renderer = renderer;
    this.api = api;

    this.container = new BoxRenderable(renderer, {
      id: "task-list",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      paddingX: 2,
      paddingTop: 1,
      paddingBottom: 0,
      gap: 1,
    });

    // Title row
    const titleRow = new BoxRenderable(renderer, {
      id: "tasklist-titlerow",
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
    });
    titleRow.add(
      new TextRenderable(renderer, {
        id: "tasklist-title",
        content: "Tasks",
        fg: theme.fg,
      }),
    );

    this.statusSummary = new TextRenderable(renderer, {
      id: "tasklist-summary",
      content: "Loading tasks...",
      fg: theme.fgDim,
    });
    titleRow.add(this.statusSummary);

    this.errorText = new TextRenderable(renderer, {
      id: "tasklist-error",
      content: "",
      fg: theme.error,
    });

    // Main content area
    const mainArea = new BoxRenderable(renderer, {
      id: "tasklist-main",
      flexDirection: "row",
      width: "100%",
      flexGrow: 1,
      gap: 2,
    });

    // Left: select list
    const leftPanel = new BoxRenderable(renderer, {
      id: "tasklist-left",
      flexDirection: "column",
      width: 82,
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Task List ",
      titleAlignment: "left",
    });

    this.taskSelect = new SelectRenderable(renderer, {
      id: "tasklist-select",
      width: 80,
      height: 20,
      options: [],
      backgroundColor: theme.bgDark,
      focusedBackgroundColor: theme.bg,
      selectedBackgroundColor: theme.bgHighlight,
      selectedTextColor: theme.fg,
      textColor: theme.fgDim,
      descriptionColor: theme.fgMuted,
      selectedDescriptionColor: theme.fgDim,
      showDescription: true,
      wrapSelection: true,
    });

    this.taskSelect.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (index: number) => {
        if (this.tasks[index]) {
          this.renderDetail(this.tasks[index]);
        }
      },
    );

    this.taskSelect.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (index: number) => {
        if (this.tasks[index]) {
          this.onTaskSelectCb?.(this.tasks[index]);
        }
      },
    );

    leftPanel.add(this.taskSelect);

    // Right: detail panel
    this.detailPanel = new BoxRenderable(renderer, {
      id: "tasklist-detail",
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Quick View ",
      titleAlignment: "left",
      padding: 1,
      height: 20,
    });

    addAll(mainArea, leftPanel, this.detailPanel);

    // Help
    const help = new TextRenderable(renderer, {
      id: "tasklist-help",
      content: "j/k: navigate  |  Enter: view details  |  d: cancel task  |  r: refresh",
      fg: theme.fgMuted,
    });

    addAll(this.container, titleRow, this.errorText, mainArea, help);
  }

  focus() {
    this.taskSelect.focus();
  }

  setOnTaskSelect(cb: TaskSelectCallback) {
    this.onTaskSelectCb = cb;
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

  async refresh() {
    try {
      const res = await this.api.listTasks(1, 50);
      this.tasks = res.tasks;
      this.errorText.content = "";
      this.renderTaskList();
      this.renderSummary();
    } catch (err: any) {
      this.errorText.content = `Error: ${err.message}`;
    }
  }

  private renderSummary() {
    const running = this.tasks.filter(
      (t) =>
        t.status === "running" ||
        t.status === "claiming_vm" ||
        t.status === "testing",
    ).length;
    const completed = this.tasks.filter((t) => t.status === "completed").length;
    const failed = this.tasks.filter((t) => t.status === "failed").length;
    const pending = this.tasks.filter((t) => t.status === "pending").length;

    this.statusSummary.content = `${completed} done  ${running} running  ${pending} pending  ${failed} failed  (${this.tasks.length} total)`;
  }

  private renderTaskList() {
    const options = this.tasks.map((task) => {
      const sIcon = statusIcon(task.status);
      const desc =
        task.description.length > 50
          ? task.description.slice(0, 47) + "..."
          : task.description;

      return {
        name: `[${sIcon}] ${task.status.padEnd(12)} ${task.mode.padEnd(8)} ${desc}`,
        description: `${task.repo_url} | ${task.branch} | ${timeAgo(task.created_at)}${task.duration_seconds ? ` | ${task.duration_seconds.toFixed(0)}s` : ""}`,
      };
    });

    this.taskSelect.options = options;
  }

  private renderDetail(task: TaskResponse) {
    removeAllChildren(this.detailPanel);

    this.detailPanel.add(
      new TextRenderable(this.renderer, {
        id: "detail-header",
        content: "Task Detail",
        fg: theme.accent,
      }),
    );

    const fields: [string, string, string][] = [
      ["ID", task.id, theme.fg],
      ["Status", task.status, statusColor(task.status)],
      ["Mode", task.mode, theme.cyan],
      ["Repo", task.repo_url, theme.fg],
      ["Branch", task.branch, theme.fg],
      ["Target", task.target_branch || "-", theme.fg],
      ["Priority", task.priority, priorityColor(task.priority)],
      ["Iterations", String(task.iterations_used), theme.fg],
      ["Files", String(task.files_changed.length), theme.fg],
      ["Duration", task.duration_seconds ? `${task.duration_seconds.toFixed(1)}s` : "-", theme.fg],
      ["Created", new Date(task.created_at).toLocaleString(), theme.fgDim],
    ];

    if (task.pr_url) fields.push(["PR", task.pr_url, theme.cyan]);
    if (task.error_message) fields.push(["Error", task.error_message, theme.error]);

    let fieldIdx = 0;
    for (const [label, value, color] of fields) {
      const row = new BoxRenderable(this.renderer, {
        id: `detail-field-${fieldIdx++}`,
        flexDirection: "row",
        height: 1,
      });
      addAll(row,
        new TextRenderable(this.renderer, {
          id: `detail-lbl-${fieldIdx}`,
          content: `${label}:`.padEnd(14),
          fg: theme.fgDim,
        }),
        new TextRenderable(this.renderer, {
          id: `detail-val-${fieldIdx}`,
          content: value,
          fg: color,
        }),
      );
      this.detailPanel.add(row);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
