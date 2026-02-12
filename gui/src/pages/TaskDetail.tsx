import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { TaskHeader } from "@/components/task-detail/TaskHeader";
import { StatusTimeline } from "@/components/task-detail/StatusTimeline";
import { AgentLogViewer } from "@/components/task-detail/AgentLogViewer";
import { TaskMetadata } from "@/components/task-detail/TaskMetadata";
import { TaskActions } from "@/components/task-detail/TaskActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchTask } from "@/services/api";
import { TaskWebSocket } from "@/services/ws";
import { ACTIVE_STATUSES } from "@/lib/constants";
import type { TaskResponse } from "@/types/api";

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = createSignal<TaskResponse | null>(null);
  const [error, setError] = createSignal("");
  const [wsLog, setWsLog] = createSignal("");

  async function loadTask() {
    try {
      const data = await fetchTask(params.id);
      setTask(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    }
  }

  createEffect(() => {
    loadTask();

    const ws = new TaskWebSocket(params.id, (msg) => {
      if (msg.type === "status_change" || msg.type === "step_complete") {
        loadTask();
      }
      if (msg.type === "log_append" && typeof msg.data.log === "string") {
        setWsLog((prev) => prev + msg.data.log);
      }
    });
    ws.connect();

    const timer = setInterval(() => {
      const t = task();
      if (t && ACTIVE_STATUSES.has(t.status)) {
        loadTask();
      }
    }, 5000);

    onCleanup(() => {
      ws.disconnect();
      clearInterval(timer);
    });
  });

  return (
    <div class="animate-in" style={{ display: "flex", "flex-direction": "column", gap: "20px" }}>
      <Show when={error()}>
        <EmptyState text={error()} icon="⚠" />
      </Show>
      <Show when={task()}>
        {(t) => (
          <>
            <div style={{ display: "flex", "justify-content": "space-between", "align-items": "flex-start" }}>
              <TaskHeader task={t()} />
              <TaskActions task={t()} onCancelled={loadTask} />
            </div>
            <StatusTimeline status={t().status} mode={t().mode} />
            <div style={{ display: "grid", "grid-template-columns": "1fr 320px", gap: "20px" }}>
              <AgentLogViewer taskId={t().id} wsLog={wsLog()} />
              <TaskMetadata task={t()} />
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
