"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useTask, useTaskLog, useCancelTask } from "@/hooks/use-tasks";
import { useTaskWebSocket } from "@/hooks/use-task-ws";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
      onSuccess: () => toast.success("Mission cancellation requested"),
      onError: (err) =>
        toast.error(`Failed to cancel: ${err.message}`),
    });
  };

  // ── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in-up">
        <Skeleton className="h-9 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
        </div>
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
      <div className="flex flex-col items-center justify-center gap-4 p-12 animate-fade-in-up">
        <p className="font-mono text-sm text-destructive uppercase tracking-wider">
          {error?.message ?? "Failed to load mission"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="font-mono uppercase tracking-wider text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!task) return null;

  const isLive = isLiveStatus(task.status);
  const canCancel = task.status === "pending" || isLive;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/tasks">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono uppercase tracking-wider text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelMutation.isPending}
                className="gap-1.5 font-mono uppercase tracking-wider text-xs"
              >
                <XCircle className="h-4 w-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Mission"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="dark:bg-[#1C1917] border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-mono text-sm uppercase tracking-wider">
                  Cancel this mission?
                </AlertDialogTitle>
                <AlertDialogDescription className="font-mono text-xs text-muted-foreground leading-relaxed">
                  This action cannot be undone. The agent will stop executing and
                  the mission will be marked as cancelled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-mono text-xs uppercase tracking-wider">
                  Keep Running
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-700 font-mono text-xs uppercase tracking-wider"
                >
                  Yes, Cancel Mission
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* ── Title ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {task.id.slice(0, 8)}
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground line-clamp-2">
          {task.description}
        </h1>
      </div>

      {/* ── Content: 2-column desktop ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
        {/* ── Left column: Tabs ───────────────────────────── */}
        <Tabs defaultValue="agent-log" className="flex flex-col gap-0">
          <TabsList>
            <TabsTrigger
              value="agent-log"
              className="font-mono uppercase tracking-wider text-xs"
            >
              Agent Log
            </TabsTrigger>
            <TabsTrigger
              value="review"
              className="font-mono uppercase tracking-wider text-xs"
            >
              Review
            </TabsTrigger>
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
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
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
            errorMessage={task.error_message}
          />
        </div>
      </div>
    </div>
  );
}
