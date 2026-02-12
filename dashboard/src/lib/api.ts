import { API_URL } from "./constants";
import type {
  TaskCreate,
  TaskResponse,
  TaskListResponse,
  TaskLogResponse,
  WarmPoolStats,
  HealthResponse,
} from "./types";

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `API ${res.status}: ${body || res.statusText}`
    );
  }

  return res.json();
}

// ── Tasks ───────────────────────────────────────────────────

export function listTasks(
  page = 1,
  perPage = 20
): Promise<TaskListResponse> {
  return fetchAPI(`/api/tasks?page=${page}&per_page=${perPage}`);
}

export function getTask(id: string): Promise<TaskResponse> {
  return fetchAPI(`/api/tasks/${id}`);
}

export function getTaskLog(id: string): Promise<TaskLogResponse> {
  return fetchAPI(`/api/tasks/${id}/log`);
}

export function createTask(
  data: TaskCreate
): Promise<TaskResponse> {
  return fetchAPI("/api/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function cancelTask(
  id: string
): Promise<{ status: string; task_id: string }> {
  return fetchAPI(`/api/tasks/${id}`, { method: "DELETE" });
}

// ── Pool ────────────────────────────────────────────────────

export function getPoolStats(): Promise<WarmPoolStats> {
  return fetchAPI("/api/pool/stats");
}

// ── Health ──────────────────────────────────────────────────

export function getHealth(): Promise<HealthResponse> {
  return fetchAPI("/api/health");
}
