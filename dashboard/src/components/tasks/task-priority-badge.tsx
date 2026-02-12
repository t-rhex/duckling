"use client";

import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { TaskPriority } from "@/lib/types";

const PRIORITY_TEXT_COLOR: Record<TaskPriority, string> = {
  low: "text-zinc-500",
  medium: "text-blue-400",
  high: "text-amber-400",
  critical: "text-red-500 font-semibold",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={cn(
        "font-mono text-xs uppercase tracking-wider",
        PRIORITY_TEXT_COLOR[priority]
      )}
    >
      {config.label}
    </span>
  );
}
