"use client";

import Link from "next/link";
import { ArrowLeft, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useTask, useTaskLog, useCancelTask } from "@/hooks/use-tasks";
import { useTaskWebSocket } from "@/hooks/use-task-ws";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusTimeline } from "@/components/detail/status-timeline";
import { AgentLogViewer } from "@/components/detail/agent-log-viewer";
import { ReviewRenderer } from "@/components/detail/review-renderer";
import { TaskMetadata } from "@/components/detail/task-metadata";
import type { TaskStatus } from "@/lib/types";

const LIVE_STATUSES: TaskStatus[] = ["running", "testing", "creating_pr"];

function isLiveStatus(status: TaskStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

export function TaskDetailClient({ id }: { id: string }) {
  const { data: task, isLoading, isError, error, refetch } = useTask(id);
  const { data: logData } = useTaskLog(id);
  const { events } = useTaskWebSocket(id);
  const cancelMutation = useCancelTask();

  const handleCancel = () => {
    cancelMutation.mutate(id, {
      onSuccess: () => toast.success("Task cancellation requested"),
      onError: (err) =>
        toast.error(`Failed to cancel: ${err.message}`),
    });
  };

  // ── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Back button skeleton */}
        <Skeleton className="h-9 w-28" />
        {/* Title skeleton */}
        <Skeleton className="h-8 w-3/4" />
        {/* Content skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-sm text-destructive">
          {error?.message ?? "Failed to load task"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!task) return null;

  const isLive = isLiveStatus(task.status);
  const canCancel = task.status === "pending" || isLive;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        {canCancel && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Task"}
          </Button>
        )}
      </div>

      {/* ── Title ─────────────────────────────────────────── */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground line-clamp-2">
        {task.description}
      </h1>

      {/* ── Content: 2-column desktop ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
        {/* ── Left column: Tabs ───────────────────────────── */}
        <Tabs defaultValue="agent-log" className="flex flex-col gap-0">
          <TabsList>
            <TabsTrigger value="agent-log">Agent Log</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="agent-log" className="mt-4">
            <AgentLogViewer
              log={logData?.log ?? ""}
              isLive={isLive}
            />
          </TabsContent>

          <TabsContent value="review" className="mt-4">
            {task.review_output ? (
              <ReviewRenderer content={task.review_output} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 py-16">
                <p className="text-sm text-muted-foreground">
                  No review output yet
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Right sidebar ───────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <TaskMetadata task={task} />
          <StatusTimeline
            status={task.status}
            createdAt={task.created_at}
            updatedAt={task.updated_at}
            completedAt={task.completed_at}
            durationSeconds={task.duration_seconds}
          />
        </div>
      </div>
    </div>
  );
}
