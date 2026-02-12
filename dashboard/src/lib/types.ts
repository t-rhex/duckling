// Types matching the Duckling orchestrator Pydantic models exactly

export type TaskStatus =
  | "pending"
  | "claiming_vm"
  | "running"
  | "testing"
  | "creating_pr"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type GitProvider = "github" | "bitbucket";

export type TaskSource = "slack" | "web_ui" | "cli" | "api";

export type TaskMode = "code" | "review" | "peer_review";

export type VMState =
  | "creating"
  | "warming"
  | "ready"
  | "claimed"
  | "running"
  | "cleaning"
  | "destroyed"
  | "error";

export type VMBackend = "firecracker" | "docker";

export interface TaskCreate {
  description: string;
  repo_url: string;
  branch?: string;
  target_branch?: string | null;
  git_provider?: GitProvider;
  priority?: TaskPriority;
  mode?: TaskMode | null;
  labels?: string[];
  source?: TaskSource;
  requester_id?: string | null;
  requester_name?: string | null;
  slack_channel_id?: string | null;
  slack_thread_ts?: string | null;
  max_iterations?: number;
  timeout_seconds?: number;
}

export interface TaskResponse {
  id: string;
  status: TaskStatus;
  description: string;
  repo_url: string;
  branch: string;
  target_branch: string | null;
  working_branch: string | null;
  git_provider: GitProvider;
  priority: TaskPriority;
  mode: TaskMode;
  source: TaskSource;
  requester_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  error_message: string | null;
  iterations_used: number;
  files_changed: string[];
  review_output: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  intent_reason: string | null;
  intent_confidence: number | null;
}

export interface TaskListResponse {
  tasks: TaskResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface TaskLogResponse {
  task_id: string;
  log: string;
  status: string;
}

export interface WarmPoolStats {
  total_vms: number;
  ready_vms: number;
  claimed_vms: number;
  creating_vms: number;
  error_vms: number;
  backend: VMBackend;
  target_pool_size: number;
  avg_claim_time_ms: number;
  avg_task_duration_s: number;
}

export interface HealthResponse {
  status: string;
  pool: WarmPoolStats | null;
  queue_connected: boolean;
}

// WebSocket event types
export interface WSStatusChangeEvent {
  event: "status_change";
  task_id: string;
  status: TaskStatus;
  description: string;
}

export interface WSStepCompleteEvent {
  event: "step_complete";
  step: string;
  success: boolean;
  duration: number;
}

export type WSEvent = WSStatusChangeEvent | WSStepCompleteEvent;
