"use client";

import { useTasks } from "@/hooks/use-tasks";
import { usePoolStats, useHealth } from "@/hooks/use-pool-stats";
import { StatCards } from "@/components/dashboard/stat-cards";
import { RecentTasks } from "@/components/dashboard/recent-tasks";
import { PoolMini } from "@/components/dashboard/pool-mini";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Autonomous coding agent platform overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health?.queue_connected ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 text-emerald-500"
            >
              <Wifi className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 border-red-500/30 text-red-500"
            >
              <WifiOff className="h-3 w-3" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      {/* Stat Cards */}
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

      {/* Bottom row: Recent Tasks + Pool Mini */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Tasks</CardTitle>
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
