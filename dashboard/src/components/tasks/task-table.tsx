"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskModeBadge } from "@/components/tasks/task-mode-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, formatRelativeTime, truncate } from "@/lib/format";
import type { TaskResponse } from "@/lib/types";

// ── Component ────────────────────────────────────────────────

interface TaskTableProps {
  tasks: TaskResponse[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  hidePageControls?: boolean;
}

const TH_CLASS =
  "uppercase tracking-wider text-[11px] font-mono text-muted-foreground";

export function TaskTable({
  tasks,
  total,
  page,
  perPage,
  onPageChange,
  hidePageControls = false,
}: TaskTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (tasks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-dashed border-zinc-800 text-sm font-mono text-muted-foreground uppercase tracking-wider">
        No missions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-zinc-800/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className={cn(TH_CLASS, "w-[130px]")}>
                Status
              </TableHead>
              <TableHead className={TH_CLASS}>Description</TableHead>
              <TableHead className={cn(TH_CLASS, "w-[110px]")}>Mode</TableHead>
              <TableHead className={cn(TH_CLASS, "w-[100px]")}>
                Priority
              </TableHead>
              <TableHead className={cn(TH_CLASS, "w-[90px] text-right")}>
                Duration
              </TableHead>
              <TableHead className={cn(TH_CLASS, "w-[100px] text-right")}>
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className="table-row-hover group cursor-pointer border-zinc-800/40 transition-colors"
              >
                <TableCell>
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block"
                  >
                    <TaskStatusBadge status={task.status} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">
                        {task.id.slice(0, 8)}
                      </span>
                      <span className="font-sans text-sm text-muted-foreground transition-colors group-hover:text-foreground truncate">
                        {truncate(task.description, 72)}
                      </span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block"
                  >
                    <TaskModeBadge mode={task.mode} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block"
                  >
                    <TaskPriorityBadge priority={task.priority} />
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDuration(task.duration_seconds)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {formatRelativeTime(task.created_at)}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!hidePageControls && (
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs uppercase tracking-wider"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs uppercase tracking-wider"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
