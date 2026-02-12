"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskModeBadge } from "@/components/tasks/task-mode-badge";
import type { TaskResponse } from "@/lib/types";

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

interface RecentTasksProps {
  tasks: TaskResponse[];
}

export function RecentTasks({ tasks }: RecentTasksProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
          No missions yet
        </p>
      </div>
    );
  }

  const headerClasses =
    "font-mono text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/40 hover:bg-transparent">
          <TableHead className={`w-[100px] ${headerClasses}`}>
            Status
          </TableHead>
          <TableHead className={headerClasses}>Description</TableHead>
          <TableHead className={`w-[100px] ${headerClasses}`}>Mode</TableHead>
          <TableHead className={`w-[80px] text-right ${headerClasses}`}>
            Time
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} className="table-row-hover group cursor-pointer border-border/30">
            <TableCell>
              <Link href={`/tasks/detail?id=${task.id}`} className="block">
                <TaskStatusBadge status={task.status} />
              </Link>
            </TableCell>
            <TableCell>
              <Link
                href={`/tasks/detail?id=${task.id}`}
                className="block transition-colors"
              >
                <span className="block font-mono text-[10px] text-muted-foreground/50 leading-none mb-0.5">
                  {task.id.slice(0, 8)}
                </span>
                <span className="block text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {truncate(task.description, 60)}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/tasks/detail?id=${task.id}`} className="block">
                <TaskModeBadge mode={task.mode} />
              </Link>
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/tasks/detail?id=${task.id}`}
                className="block font-mono text-xs text-muted-foreground"
              >
                {formatRelativeTime(task.updated_at)}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
