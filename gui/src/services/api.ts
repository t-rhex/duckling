import type {
  HealthResponse,
  TaskCreateRequest,
  TaskListResponse,
  TaskLogResponse,
  TaskResponse,
  WarmPoolStats,
} from "@/types/api";
import { apiUrl } from "@/stores/settings";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export function fetchHealth(): Promise<HealthResponse> {
  return request("/api/health");
}

export function fetchTasks(page = 1, perPage = 20): Promise<TaskListResponse> {
  return request(`/api/tasks?page=${page}&per_page=${perPage}`);
}

export function fetchTask(id: string): Promise<TaskResponse> {
  return request(`/api/tasks/${id}`);
}

export function createTask(body: TaskCreateRequest): Promise<TaskResponse> {
  return request("/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function cancelTask(id: string): Promise<{ status: string; task_id: string }> {
  return request(`/api/tasks/${id}`, { method: "DELETE" });
}

export function fetchTaskLog(id: string): Promise<TaskLogResponse> {
  return request(`/api/tasks/${id}/log`);
}

export function fetchPoolStats(): Promise<WarmPoolStats> {
  return request("/api/pool/stats");
}
