"use client";

import type { WarmPoolStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

interface PoolGridProps {
  stats: WarmPoolStats;
}

interface SlotCategory {
  label: string;
  count: number;
  bg: string;
  border: string;
  dot: string;
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
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/40",
      dot: "bg-emerald-500",
    },
    {
      label: "Claimed",
      count: claimed_vms,
      bg: "bg-blue-500/20",
      border: "border-blue-500/40",
      dot: "bg-blue-500",
    },
    {
      label: "Creating",
      count: creating_vms,
      bg: "bg-amber-500/20",
      border: "border-amber-500/40",
      dot: "bg-amber-500",
    },
    {
      label: "Error",
      count: error_vms,
      bg: "bg-red-500/20",
      border: "border-red-500/40",
      dot: "bg-red-500",
    },
    {
      label: "Unknown",
      count: unknown_vms,
      bg: "bg-zinc-500/10",
      border: "border-zinc-500/25",
      dot: "bg-zinc-400",
    },
  ];

  // Build the flat array of slots for rendering
  const slots: { bg: string; border: string }[] = [];
  for (const cat of categories) {
    for (let i = 0; i < cat.count; i++) {
      slots.push({ bg: cat.bg, border: cat.border });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── VM Slot Grid ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            VM Slots ({total_vms})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total_vms === 0 ? (
            <p className="text-sm text-muted-foreground">No VMs in pool</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((slot, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-8 w-8 rounded-md border transition-colors",
                    slot.bg,
                    slot.border
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Metric Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Backend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-semibold capitalize text-foreground">
              {backend}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg Claim Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatMs(avg_claim_time_ms)}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg Task Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatSeconds(avg_task_duration_s)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        {categories
          .filter((c) => c.count > 0)
          .map((cat) => (
            <div key={cat.label} className="flex items-center gap-1.5">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", cat.dot)}
              />
              <span className="text-xs text-muted-foreground">
                {cat.label} ({cat.count})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
