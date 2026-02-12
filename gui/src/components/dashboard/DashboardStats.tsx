import { StatCard } from "@/components/ui/StatCard";
import type { HealthResponse, TaskListResponse } from "@/types/api";
import { formatClaimTime } from "@/lib/formatters";
import { TaskStatus } from "@/types/enums";
import "./DashboardStats.css";

interface DashboardStatsProps {
  health: HealthResponse | null;
  tasks: TaskListResponse | null;
}

export function DashboardStats(props: DashboardStatsProps) {
  const activeTasks = () => {
    if (!props.tasks) return 0;
    return props.tasks.tasks.filter(
      (t) =>
        t.status !== TaskStatus.COMPLETED &&
        t.status !== TaskStatus.FAILED &&
        t.status !== TaskStatus.CANCELLED
    ).length;
  };

  const completedTasks = () => {
    if (!props.tasks) return 0;
    return props.tasks.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  };

  const readyVMs = () => props.health?.pool?.ready_vms ?? 0;

  const avgClaim = () => {
    const ms = props.health?.pool?.avg_claim_time_ms ?? 0;
    return formatClaimTime(ms);
  };

  const successRate = () => {
    if (!props.tasks || props.tasks.tasks.length === 0) return "—";
    const completed = props.tasks.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const terminal = props.tasks.tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED
    ).length;
    if (terminal === 0) return "—";
    return `${Math.round((completed / terminal) * 100)}%`;
  };

  return (
    <div class="dashboard-stats stagger">
      <StatCard label="Active Tasks" value={activeTasks()} color="var(--accent-blue)" />
      <StatCard label="Completed" value={completedTasks()} color="var(--accent-green)" />
      <StatCard label="VMs Ready" value={readyVMs()} color="var(--accent-cyan)" />
      <StatCard label="Avg Claim" value={avgClaim()} color="var(--accent-yellow)" />
      <StatCard label="Success Rate" value={successRate()} color="var(--accent-purple)" />
    </div>
  );
}
