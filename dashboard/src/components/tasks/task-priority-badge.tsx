"use client";

import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { TaskPriority } from "@/lib/types";

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", config.color)}>
      {config.label}
    </span>
  );
}
