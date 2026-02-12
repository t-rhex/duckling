"use client";

import type { TaskStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";

interface StatusTimelineProps {
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

const TIMELINE_STEPS: TaskStatus[] = [
  "pending",
  "claiming_vm",
  "running",
  "testing",
  "creating_pr",
  "completed",
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function StatusTimeline({
  status,
  createdAt,
  updatedAt,
  completedAt,
  durationSeconds,
}: StatusTimelineProps) {
  const currentIndex = TIMELINE_STEPS.indexOf(status);
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col">
        {TIMELINE_STEPS.map((step, index) => {
          const config = STATUS_CONFIG[step];
          const isCompleted = index < currentIndex || status === "completed";
          const isCurrent =
            index === currentIndex && !isFailed && !isCancelled;
          const isFuture = index > currentIndex;
          const isLast = index === TIMELINE_STEPS.length - 1;

          return (
            <div key={step} className="flex items-start gap-3">
              {/* Vertical line + icon column */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted &&
                      "border-[var(--duckling-amber)] bg-[var(--duckling-amber-soft)] text-[var(--duckling-amber)]",
                    isCurrent && "border-blue-500 bg-blue-500/10 text-blue-500",
                    isFuture &&
                      "border-zinc-700 bg-zinc-800/50 text-zinc-600"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "min-h-5 w-px flex-1",
                      isCompleted
                        ? "bg-[var(--duckling-amber-muted)]"
                        : isCurrent
                          ? "bg-blue-500/30"
                          : "border-l border-dashed border-zinc-700 bg-transparent"
                    )}
                  />
                )}
              </div>

              {/* Label + timestamp */}
              <div className="flex flex-col pb-4">
                <span
                  className={cn(
                    "font-mono text-xs uppercase leading-7 tracking-wider",
                    isCompleted && "text-foreground",
                    isCurrent && "text-blue-500",
                    isFuture && "text-zinc-600"
                  )}
                >
                  {config.label}
                </span>
                {isCompleted && index === 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatTime(createdAt)}
                  </span>
                )}
                {isCompleted && step === "completed" && completedAt && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatTime(completedAt)}
                  </span>
                )}
                {isCurrent && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatTime(updatedAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Failed / cancelled indicator */}
      {(isFailed || isCancelled) && (
        <div className="mt-1 flex items-center gap-3">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
              isFailed && "border-red-500 bg-red-500/10 text-red-500",
              isCancelled && "border-zinc-400 bg-zinc-400/10 text-zinc-400"
            )}
          >
            <Circle className="h-3 w-3 fill-current" />
          </div>
          <div className="flex flex-col">
            <span
              className={cn(
                "font-mono text-xs uppercase tracking-wider",
                isFailed && "text-red-500",
                isCancelled && "text-zinc-400"
              )}
            >
              {STATUS_CONFIG[status].label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTime(updatedAt)}
            </span>
          </div>
        </div>
      )}

      {/* Duration */}
      {durationSeconds != null && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-[rgba(251,191,36,0.08)] bg-[var(--duckling-amber-soft)] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Duration
          </span>
          <span className="font-mono text-xs font-semibold text-[var(--duckling-amber)]">
            {formatDuration(durationSeconds)}
          </span>
        </div>
      )}
    </div>
  );
}
