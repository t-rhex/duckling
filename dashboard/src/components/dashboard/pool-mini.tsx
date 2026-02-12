"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WarmPoolStats } from "@/lib/types";

interface PoolMiniProps {
  stats: WarmPoolStats;
}

const statusSegments = [
  { key: "ready", label: "Ready", field: "ready_vms" as const, color: "bg-emerald-500" },
  { key: "claimed", label: "Claimed", field: "claimed_vms" as const, color: "bg-blue-500" },
  { key: "creating", label: "Creating", field: "creating_vms" as const, color: "bg-amber-500" },
  { key: "error", label: "Error", field: "error_vms" as const, color: "bg-red-500" },
] as const;

/**
 * Builds an ordered array of dot statuses from the pool stats.
 * Each entry is the key of a segment ("ready" | "claimed" | "creating" | "error").
 * Remaining slots (target minus total) are rendered as "empty".
 */
function buildDotGrid(
  stats: WarmPoolStats
): Array<"ready" | "claimed" | "creating" | "error" | "empty"> {
  const dots: Array<"ready" | "claimed" | "creating" | "error" | "empty"> = [];

  for (const seg of statusSegments) {
    const count = stats[seg.field];
    for (let i = 0; i < count; i++) {
      dots.push(seg.key as "ready" | "claimed" | "creating" | "error");
    }
  }

  // Fill remaining slots up to target_pool_size with empty
  const targetSlots = Math.max(stats.target_pool_size, stats.total_vms);
  while (dots.length < targetSlots) {
    dots.push("empty");
  }

  return dots;
}

const dotColorMap: Record<string, string> = {
  ready: "bg-emerald-500",
  claimed: "bg-blue-500",
  creating: "bg-amber-500 animate-pulse",
  error: "bg-red-500",
  empty: "bg-muted-foreground/20",
};

export function PoolMini({ stats }: PoolMiniProps) {
  const dots = buildDotGrid(stats);

  return (
    <Card className="card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] font-mono font-medium uppercase tracking-widest text-muted-foreground">
          FLEET STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Indicator-light dot grid */}
        <div className="flex flex-wrap gap-1.5">
          {dots.map((status, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-sm transition-colors duration-300",
                dotColorMap[status]
              )}
              title={status}
            />
          ))}
        </div>

        {/* Compact stats row */}
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-mono font-bold tracking-tight">
            {stats.total_vms}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            / {stats.target_pool_size} target
          </span>
        </div>

        {/* Legend row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {statusSegments.map(({ key, label, field }) => {
            const count = stats[field];
            if (count === 0) return null;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    dotColorMap[key]
                  )}
                />
                <span className="text-[10px] font-mono tabular-nums text-foreground">
                  {count}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 border-t border-border pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              BACKEND
            </span>
            <span className="text-xs font-mono text-foreground">
              {stats.backend}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AVG CLAIM
            </span>
            <span className="text-xs font-mono text-foreground">
              {stats.avg_claim_time_ms}ms
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              AVG TASK
            </span>
            <span className="text-xs font-mono text-foreground">
              {stats.avg_task_duration_s}s
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
