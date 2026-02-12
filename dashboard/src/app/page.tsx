"use client";

import { useTasks } from "@/hooks/use-tasks";
import { usePoolStats, useHealth } from "@/hooks/use-pool-stats";
import { StatCards } from "@/components/dashboard/stat-cards";
import { RecentTasks } from "@/components/dashboard/recent-tasks";
import { PoolMini } from "@/components/dashboard/pool-mini";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DashboardHome() {
  const { data: taskData, isLoading: tasksLoading } = useTasks(1, 10);
  const { data: poolStats, isLoading: poolLoading } = usePoolStats();
  const { data: health } = useHealth();

  const tasks = taskData?.tasks ?? [];
  const activeTasks = tasks.filter(
    (t) =>
      t.status === "running" ||
      t.status === "testing" ||
      t.status === "creating_pr"
  ).length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  const isConnected = health?.queue_connected ?? false;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-mono font-bold uppercase tracking-widest">
            Mission Control
          </h1>
          {/* Amber status dot */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--duckling-amber)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--duckling-amber)]" />
          </span>
        </div>

        {/* Connection status — dramatic indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 glow-amber-sm" style={{ boxShadow: "0 0 8px 2px rgba(16, 185, 129, 0.4)" }} />
                </>
              ) : (
                <>
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 8px 2px rgba(239, 68, 68, 0.5)" }} />
                </>
              )}
            </span>
            <span
              className={cn(
                "text-[10px] font-mono font-medium uppercase tracking-widest",
                isConnected ? "text-emerald-500" : "text-red-500"
              )}
            >
              {isConnected ? "LINKED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Thin ambient separator */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--duckling-amber-muted)] to-transparent" />

      {/* ── Stat Cards ── */}
      {tasksLoading || poolLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <StatCards
          activeTasks={activeTasks}
          completedTasks={completedTasks}
          readyVMs={poolStats?.ready_vms ?? 0}
          avgClaimTime={poolStats?.avg_claim_time_ms ?? 0}
        />
      )}

      {/* ── Bottom Row: Recent Tasks + Pool Mini ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Tasks — 2 cols */}
        <div className="lg:col-span-2">
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-mono font-medium uppercase tracking-widest text-muted-foreground">
                RECENT
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <RecentTasks tasks={tasks.slice(0, 5)} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pool Mini — 1 col */}
        <div>
          {poolLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : poolStats ? (
            <PoolMini stats={poolStats} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
