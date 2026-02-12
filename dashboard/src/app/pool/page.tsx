"use client";

import { usePoolStats, useHealth } from "@/hooks/use-pool-stats";
import PoolGrid from "@/components/pool/pool-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function PoolPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
  } = usePoolStats();
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
    error: healthErr,
  } = useHealth();

  const isLoading = statsLoading || healthLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-fade-in flex flex-col gap-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-[72px] rounded-lg" />
          <Skeleton className="h-[72px] rounded-lg" />
          <Skeleton className="h-[72px] rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (statsError || healthError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="font-mono text-sm text-destructive">
          {statsErr?.message ?? healthErr?.message ?? "Failed to load pool data"}
        </p>
      </div>
    );
  }

  const isHealthy = health?.status === "healthy";
  const queueConnected = health?.queue_connected ?? false;

  return (
    <div className="animate-fade-in-up flex flex-col gap-6">
      {/* Page Title */}
      <h1 className="font-mono text-lg uppercase tracking-widest text-foreground">
        VM Pool
      </h1>

      {/* Indicator lights + inline metrics */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Health status */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isHealthy ? "bg-emerald-500" : "bg-red-500"
            )}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {isHealthy ? "Healthy" : "Unhealthy"}
          </span>
        </div>

        {/* Queue connection */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              queueConnected ? "bg-emerald-500" : "bg-red-500"
            )}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {queueConnected ? "Queue Connected" : "Queue Disconnected"}
          </span>
        </div>

        {/* Separator */}
        <div className="hidden h-4 w-px bg-zinc-700 sm:block" />

        {/* Pool summary inline metrics */}
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            Target{" "}
            <Badge
              variant="secondary"
              className="ml-1 font-mono text-xs tabular-nums"
            >
              {stats?.target_pool_size ?? "--"}
            </Badge>
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            Total{" "}
            <Badge
              variant="secondary"
              className="ml-1 font-mono text-xs tabular-nums"
            >
              {stats?.total_vms ?? "--"}
            </Badge>
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            Ready{" "}
            <Badge
              variant="secondary"
              className="ml-1 font-mono text-xs tabular-nums"
            >
              {stats?.ready_vms ?? "--"}
            </Badge>
          </span>
        </div>
      </div>

      {/* Pool Grid */}
      {stats && <PoolGrid stats={stats} />}
    </div>
  );
}
