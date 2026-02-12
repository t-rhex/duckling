"use client";

import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

const ACTIVE_STATUSES: Set<TaskStatus> = new Set([
  "running",
  "testing",
  "creating_pr",
]);

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status];
  const isActive = ACTIVE_STATUSES.has(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5",
        "text-xs font-mono uppercase tracking-wider",
        config.color
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          config.dotColor,
          isActive && "status-dot-pulse"
        )}
      />
      {config.label}
    </span>
  );
}
