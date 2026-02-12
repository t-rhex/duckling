import { createSignal, createEffect, onCleanup } from "solid-js";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { ActiveTasksFeed } from "@/components/dashboard/ActiveTasksFeed";
import { VMPoolGrid } from "@/components/dashboard/VMPoolGrid";
import { fetchHealth } from "@/services/api";
import { fetchTasks } from "@/services/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { HealthResponse, TaskListResponse } from "@/types/api";

export default function Dashboard() {
  const [health, setHealth] = createSignal<HealthResponse | null>(null);
  const [tasks, setTasks] = createSignal<TaskListResponse | null>(null);

  async function loadData() {
    try {
      const [h, t] = await Promise.all([fetchHealth(), fetchTasks(1, 50)]);
      setHealth(h);
      setTasks(t);
    } catch {
      // connection may be down
    }
  }

  createEffect(() => {
    loadData();
    const timer = setInterval(loadData, POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="animate-in" style={{ display: "flex", "flex-direction": "column", gap: "28px" }}>
      <DashboardStats health={health()} tasks={tasks()} />
      <div style={{ display: "grid", "grid-template-columns": "2fr 1fr", gap: "28px" }}>
        <ActiveTasksFeed tasks={tasks()?.tasks ?? []} />
        <VMPoolGrid stats={health()?.pool ?? null} />
      </div>
    </div>
  );
}
