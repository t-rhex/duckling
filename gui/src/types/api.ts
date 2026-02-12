import { TaskStatus, TaskPriority, TaskMode, GitProvider, TaskSource, VMBackend } from "./enums";

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
}

export interface TaskListResponse {
  tasks: TaskResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface TaskCreateRequest {
  description: string;
  repo_url: string;
  branch: string;
  target_branch?: string;
  git_provider?: GitProvider;
  priority?: TaskPriority;
  mode?: TaskMode;
  source?: TaskSource;
  max_iterations?: number;
  timeout_seconds?: number;
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

export interface WSMessage {
  type: "status_change" | "step_complete" | "log_append";
  task_id: string;
  data: Record<string, unknown>;
}
