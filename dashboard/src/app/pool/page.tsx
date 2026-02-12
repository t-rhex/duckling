"use client";

import { usePoolStats, useHealth } from "@/hooks/use-pool-stats";
import PoolGrid from "@/components/pool/pool-grid";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Server } from "lucide-react";

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

  // ── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-[120px] rounded-lg" />
          <Skeleton className="h-[120px] rounded-lg" />
        </div>
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (statsError || healthError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12">
        <p className="text-sm text-destructive">
          {statsErr?.message ?? healthErr?.message ?? "Failed to load pool data"}
        </p>
      </div>
    );
  }

  const isHealthy = health?.status === "healthy";
  const queueConnected = health?.queue_connected ?? false;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Page Title ────────────────────────────────────── */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        VM Pool
      </h1>

      {/* ── Health Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Server className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={isHealthy ? "default" : "destructive"}
                className={
                  isHealthy
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : undefined
                }
              >
                {isHealthy ? "Healthy" : "Unhealthy"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {queueConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  Queue connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                  Queue disconnected
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pool Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Server className="h-4 w-4" />
              Pool Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Target Size</dt>
                <dd className="font-mono text-lg font-semibold text-foreground">
                  {stats?.target_pool_size ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total VMs</dt>
                <dd className="font-mono text-lg font-semibold text-foreground">
                  {stats?.total_vms ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Backend</dt>
                <dd className="text-lg font-semibold capitalize text-foreground">
                  {stats?.backend ?? "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* ── Pool Grid ─────────────────────────────────────── */}
      {stats && <PoolGrid stats={stats} />}
    </div>
  );
}
