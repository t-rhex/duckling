/**
 * Duckling TUI color theme — inspired by Tokyo Night.
 *
 * Provides a consistent color palette across all screens.
 */

export const theme = {
  // ── Backgrounds ─────────────────────────────────────────
  bg: "#1a1b26",
  bgDark: "#16161e",
  bgLight: "#24283b",
  bgHighlight: "#292e42",
  bgFloat: "#1f2335",

  // ── Foregrounds ─────────────────────────────────────────
  fg: "#c0caf5",
  fgDim: "#565f89",
  fgMuted: "#3b4261",
  fgBright: "#e0e6ff",

  // ── Accent colors ──────────────────────────────────────
  blue: "#7aa2f7",
  cyan: "#7dcfff",
  green: "#9ece6a",
  yellow: "#e0af68",
  orange: "#ff9e64",
  red: "#f7768e",
  magenta: "#bb9af7",
  teal: "#73daca",

  // ── Semantic ────────────────────────────────────────────
  accent: "#7aa2f7",
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",
  info: "#7dcfff",

  // ── Status colors ──────────────────────────────────────
  statusPending: "#565f89",
  statusRunning: "#7aa2f7",
  statusTesting: "#e0af68",
  statusCompleted: "#9ece6a",
  statusFailed: "#f7768e",
  statusCancelled: "#565f89",

  // ── Borders ─────────────────────────────────────────────
  border: "#3b4261",
  borderFocused: "#7aa2f7",
  borderDim: "#292e42",

  // ── Priority colors ─────────────────────────────────────
  priorityLow: "#565f89",
  priorityMedium: "#7aa2f7",
  priorityHigh: "#e0af68",
  priorityCritical: "#f7768e",
} as const satisfies Record<string, string>;

/**
 * Get the appropriate color for a task status.
 */
export function statusColor(status: string): string {
  switch (status) {
    case "pending":
      return theme.statusPending;
    case "claiming_vm":
      return theme.statusRunning;
    case "running":
      return theme.statusRunning;
    case "testing":
      return theme.statusTesting;
    case "creating_pr":
      return theme.statusRunning;
    case "completed":
      return theme.statusCompleted;
    case "failed":
      return theme.statusFailed;
    case "cancelled":
      return theme.statusCancelled;
    default:
      return theme.fgDim;
  }
}

/**
 * Get the appropriate color for a task priority.
 */
export function priorityColor(priority: string): string {
  switch (priority) {
    case "low":
      return theme.priorityLow;
    case "medium":
      return theme.priorityMedium;
    case "high":
      return theme.priorityHigh;
    case "critical":
      return theme.priorityCritical;
    default:
      return theme.fgDim;
  }
}

/**
 * Status icons (simple ASCII since we avoid emoji).
 */
export function statusIcon(status: string): string {
  switch (status) {
    case "pending":
      return "o";
    case "claiming_vm":
      return "~";
    case "running":
      return ">";
    case "testing":
      return "?";
    case "creating_pr":
      return "^";
    case "completed":
      return "*";
    case "failed":
      return "x";
    case "cancelled":
      return "-";
    default:
      return ".";
  }
}
