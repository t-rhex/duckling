"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WarmPoolStats } from "@/lib/types";

interface PoolMiniProps {
  stats: WarmPoolStats;
}

const segments = [
  { key: "ready", label: "ready", field: "ready_vms", color: "bg-emerald-500" },
  { key: "claimed", label: "claimed", field: "claimed_vms", color: "bg-blue-500" },
  { key: "creating", label: "creating", field: "creating_vms", color: "bg-amber-500" },
  { key: "error", label: "error", field: "error_vms", color: "bg-red-500" },
] as const;

const dotColors: Record<string, string> = {
  ready: "bg-emerald-500",
  claimed: "bg-blue-500",
  creating: "bg-amber-500",
  error: "bg-red-500",
};

export function PoolMini({ stats }: PoolMiniProps) {
  const total = stats.total_vms || 1; // avoid division by zero

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Warm Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {segments.map(({ key, field, color }) => {
            const count = stats[field];
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                className={cn("h-full transition-all duration-500", color)}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>

        {/* Legend / metric row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {segments.map(({ key, label, field }) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  dotColors[key]
                )}
              />
              <span className="font-mono text-foreground">
                {stats[field]}
              </span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
