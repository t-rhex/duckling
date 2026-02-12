"use client";

import type { WarmPoolStats } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PoolGridProps {
  stats: WarmPoolStats;
}

interface SlotCategory {
  label: string;
  count: number;
  bg: string;
  dot: string;
  pulse?: boolean;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export default function PoolGrid({ stats }: PoolGridProps) {
  const {
    total_vms,
    ready_vms,
    claimed_vms,
    creating_vms,
    error_vms,
    backend,
    avg_claim_time_ms,
    avg_task_duration_s,
  } = stats;

  const accounted = ready_vms + claimed_vms + creating_vms + error_vms;
  const unknown_vms = Math.max(0, total_vms - accounted);

  const categories: SlotCategory[] = [
    {
      label: "Ready",
      count: ready_vms,
      bg: "bg-emerald-500",
      dot: "bg-emerald-500",
    },
    {
      label: "Claimed",
      count: claimed_vms,
      bg: "bg-blue-500",
      dot: "bg-blue-500",
    },
    {
      label: "Creating",
      count: creating_vms,
      bg: "bg-amber-500",
      dot: "bg-amber-500",
      pulse: true,
    },
    {
      label: "Error",
      count: error_vms,
      bg: "bg-red-500",
      dot: "bg-red-500",
    },
    {
      label: "Unknown",
      count: unknown_vms,
      bg: "bg-zinc-600",
      dot: "bg-zinc-500",
    },
  ];

  // Build the flat array of slots for rendering
  const slots: { bg: string; pulse: boolean }[] = [];
  for (const cat of categories) {
    for (let i = 0; i < cat.count; i++) {
      slots.push({ bg: cat.bg, pulse: cat.pulse ?? false });
    }
  }

  const metrics = [
    { label: "Backend", value: backend, capitalize: true },
    { label: "Avg Claim", value: formatMs(avg_claim_time_ms) },
    { label: "Avg Duration", value: formatSeconds(avg_task_duration_s) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* VM Slot Grid */}
      <div className="rounded-lg border border-[rgba(251,191,36,0.08)] bg-card p-4">
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          VM Slots ({total_vms})
        </h3>
        {total_vms === 0 ? (
          <p className="font-mono text-xs text-zinc-600">No VMs in pool</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {slots.map((slot, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 w-3 rounded-sm",
                  slot.bg,
                  slot.pulse && "animate-pulse"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-[rgba(251,191,36,0.08)] bg-card p-3"
          >
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {metric.label}
            </span>
            <span
              className={cn(
                "mt-1 block font-mono text-lg font-semibold text-foreground",
                metric.capitalize && "capitalize"
              )}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {categories
          .filter((c) => c.count > 0)
          .map((cat) => (
            <div key={cat.label} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", cat.dot)} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {cat.label} ({cat.count})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
