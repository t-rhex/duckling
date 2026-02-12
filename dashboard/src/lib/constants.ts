import type { TaskStatus, TaskPriority, TaskMode } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  API_URL.replace(/^http/, "ws");

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; dotColor: string }
> = {
  pending: {
    label: "Pending",
    color: "bg-zinc-500/10 text-zinc-500",
    dotColor: "bg-zinc-500",
  },
  claiming_vm: {
    label: "Claiming VM",
    color: "bg-amber-500/10 text-amber-500",
    dotColor: "bg-amber-500",
  },
  running: {
    label: "Running",
    color: "bg-blue-500/10 text-blue-500",
    dotColor: "bg-blue-500 animate-pulse",
  },
  testing: {
    label: "Testing",
    color: "bg-violet-500/10 text-violet-500",
    dotColor: "bg-violet-500 animate-pulse",
  },
  creating_pr: {
    label: "Creating PR",
    color: "bg-cyan-500/10 text-cyan-500",
    dotColor: "bg-cyan-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-500/10 text-emerald-500",
    dotColor: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/10 text-red-500",
    dotColor: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-zinc-500/10 text-zinc-400",
    dotColor: "bg-zinc-400",
  },
};

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  low: { label: "Low", color: "bg-zinc-500/10 text-zinc-500" },
  medium: { label: "Medium", color: "bg-blue-500/10 text-blue-500" },
  high: { label: "High", color: "bg-amber-500/10 text-amber-500" },
  critical: { label: "Critical", color: "bg-red-500/10 text-red-500" },
};

export const MODE_CONFIG: Record<
  TaskMode,
  { label: string; color: string; icon: string }
> = {
  code: { label: "Code", color: "bg-emerald-500/10 text-emerald-500", icon: "Code2" },
  review: { label: "Review", color: "bg-violet-500/10 text-violet-500", icon: "Search" },
  peer_review: {
    label: "Peer Review",
    color: "bg-cyan-500/10 text-cyan-500",
    icon: "GitBranch",
  },
};

export const POLLING_INTERVALS = {
  tasks: 5000,
  taskDetail: 3000,
  pool: 4000,
  health: 10000,
} as const;
