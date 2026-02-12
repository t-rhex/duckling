"use client";

import { cn } from "@/lib/utils";
import { MODE_CONFIG } from "@/lib/constants";
import type { TaskMode } from "@/lib/types";
import { Code2, Search, GitBranch } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Code2,
  Search,
  GitBranch,
};

export function TaskModeBadge({ mode }: { mode: TaskMode }) {
  const config = MODE_CONFIG[mode];
  const Icon = ICONS[config.icon];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5",
        "font-mono text-xs uppercase tracking-wider",
        config.color
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {config.label}
    </span>
  );
}
