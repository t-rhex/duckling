/**
 * Duckling API client — talks to the orchestrator REST API + WebSocket.
 *
 * Base URL defaults to http://localhost:8000
 */

// ── Types matching orchestrator/models/task.py ────────────────────

export type TaskStatus =
  | "pending"
  | "claiming_vm"
  | "running"
  | "testing"
  | "creating_pr"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskMode = "code" | "review" | "peer_review";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type GitProvider = "github" | "bitbucket";
export type TaskSource = "slack" | "web_ui" | "cli" | "api";

export interface TaskCreate {
  description: string;
  repo_url: string;
  branch?: string;
  target_branch?: string;
  git_provider?: GitProvider;
  priority?: TaskPriority;
  mode?: TaskMode;
  labels?: string[];
  source?: TaskSource;
  requester_name?: string;
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

export interface PoolStats {
  total_vms: number;
  ready_vms: number;
  claimed_vms: number;
  creating_vms: number;
  error_vms: number;
  backend: string;
  target_pool_size: number;
  avg_claim_time_ms: number;
  avg_task_duration_s: number;
}

export interface HealthResponse {
  status: string;
  pool: PoolStats | null;
  queue_connected: boolean;
}

export interface TaskLogResponse {
  task_id: string;
  log: string;
  status: string;
}

// ── API Client ────────────────────────────────────────────────────

export class DucklingAPI {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err: any) {
      if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
        throw new Error(`Cannot connect to Duckling at ${this.baseUrl}. Is the orchestrator running?`);
      }
      throw err;
    }
  }

  // ── Tasks ────────────────────────────────────────────────

  async createTask(body: TaskCreate): Promise<TaskResponse> {
    return this.fetch<TaskResponse>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ ...body, source: "cli" }),
    });
  }

  async listTasks(page = 1, perPage = 20): Promise<TaskListResponse> {
    return this.fetch<TaskListResponse>(`/api/tasks?page=${page}&per_page=${perPage}`);
  }

  async getTask(taskId: string): Promise<TaskResponse> {
    return this.fetch<TaskResponse>(`/api/tasks/${taskId}`);
  }

  async cancelTask(taskId: string): Promise<{ status: string; task_id: string }> {
    return this.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  }

  async getTaskLog(taskId: string): Promise<TaskLogResponse> {
    return this.fetch<TaskLogResponse>(`/api/tasks/${taskId}/log`);
  }

  // ── Pool ─────────────────────────────────────────────────

  async getPoolStats(): Promise<PoolStats> {
    return this.fetch<PoolStats>("/api/pool/stats");
  }

  // ── Health ───────────────────────────────────────────────

  async getHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>("/api/health");
  }

  // ── WebSocket ────────────────────────────────────────────

  connectTaskWs(taskId: string): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, "ws") + `/ws/tasks/${taskId}`;
    return new WebSocket(wsUrl);
  }
}
