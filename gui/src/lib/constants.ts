import { TaskStatus, TaskPriority, TaskMode, VMState } from "@/types/enums";

export const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "#AEAEB2",
  [TaskStatus.CLAIMING_VM]: "#32ADE6",
  [TaskStatus.RUNNING]: "#007AFF",
  [TaskStatus.TESTING]: "#FF9F0A",
  [TaskStatus.CREATING_PR]: "#AF52DE",
  [TaskStatus.COMPLETED]: "#34C759",
  [TaskStatus.FAILED]: "#FF3B30",
  [TaskStatus.CANCELLED]: "#AEAEB2",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.CLAIMING_VM]: "Claiming VM",
  [TaskStatus.RUNNING]: "Running",
  [TaskStatus.TESTING]: "Testing",
  [TaskStatus.CREATING_PR]: "Creating PR",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.FAILED]: "Failed",
  [TaskStatus.CANCELLED]: "Cancelled",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "var(--text-muted)",
  [TaskPriority.MEDIUM]: "var(--accent-blue)",
  [TaskPriority.HIGH]: "var(--accent-yellow)",
  [TaskPriority.CRITICAL]: "var(--accent-red)",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "Low",
  [TaskPriority.MEDIUM]: "Medium",
  [TaskPriority.HIGH]: "High",
  [TaskPriority.CRITICAL]: "Critical",
};

export const VM_STATE_COLORS: Record<VMState, string> = {
  [VMState.CREATING]: "var(--text-muted)",
  [VMState.WARMING]: "var(--accent-yellow)",
  [VMState.READY]: "var(--accent-green)",
  [VMState.CLAIMED]: "var(--accent-blue)",
  [VMState.RUNNING]: "var(--accent-cyan)",
  [VMState.CLEANING]: "var(--accent-purple)",
  [VMState.DESTROYED]: "var(--text-muted)",
  [VMState.ERROR]: "var(--accent-red)",
};

export const MODE_LABELS: Record<TaskMode, string> = {
  [TaskMode.CODE]: "Code",
  [TaskMode.REVIEW]: "Review",
  [TaskMode.PEER_REVIEW]: "Peer Review",
};

export const MODE_DESCRIPTIONS: Record<TaskMode, string> = {
  [TaskMode.CODE]: "Branch, code, test, and create a PR",
  [TaskMode.REVIEW]: "Clone and analyze only — no code changes",
  [TaskMode.PEER_REVIEW]: "Review a coworker's branch diff before merge",
};

export const PIPELINE_STEPS = [
  { key: "pending", label: "Queue", status: TaskStatus.PENDING },
  { key: "claiming_vm", label: "Claim VM", status: TaskStatus.CLAIMING_VM },
  { key: "running", label: "Coding", status: TaskStatus.RUNNING },
  { key: "testing", label: "Testing", status: TaskStatus.TESTING },
  { key: "creating_pr", label: "PR", status: TaskStatus.CREATING_PR },
  { key: "completed", label: "Done", status: TaskStatus.COMPLETED },
] as const;

export const REVIEW_PIPELINE_STEPS = [
  { key: "pending", label: "Queue", status: TaskStatus.PENDING },
  { key: "claiming_vm", label: "Claim VM", status: TaskStatus.CLAIMING_VM },
  { key: "running", label: "Analyzing", status: TaskStatus.RUNNING },
  { key: "completed", label: "Done", status: TaskStatus.COMPLETED },
] as const;

export const PEER_REVIEW_PIPELINE_STEPS = [
  { key: "pending", label: "Queue", status: TaskStatus.PENDING },
  { key: "claiming_vm", label: "Claim VM", status: TaskStatus.CLAIMING_VM },
  { key: "running", label: "Reviewing", status: TaskStatus.RUNNING },
  { key: "completed", label: "Done", status: TaskStatus.COMPLETED },
] as const;

export const ACTIVE_STATUSES = new Set([
  TaskStatus.PENDING,
  TaskStatus.CLAIMING_VM,
  TaskStatus.RUNNING,
  TaskStatus.TESTING,
  TaskStatus.CREATING_PR,
]);

export const CANCELABLE_STATUSES = new Set([
  TaskStatus.PENDING,
  TaskStatus.CLAIMING_VM,
  TaskStatus.RUNNING,
  TaskStatus.TESTING,
]);

export const DEFAULT_API_URL = "http://localhost:8000";
export const POLL_INTERVAL_MS = 5000;
export const WS_PING_INTERVAL_MS = 30000;
