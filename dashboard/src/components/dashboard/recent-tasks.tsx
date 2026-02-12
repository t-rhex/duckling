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
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No recent tasks
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="w-[100px]">Mode</TableHead>
          <TableHead className="w-[80px] text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} className="group cursor-pointer">
            <TableCell>
              <Link href={`/tasks/detail?id=${task.id}`} className="block">
                <TaskStatusBadge status={task.status} />
              </Link>
            </TableCell>
            <TableCell>
              <Link
                href={`/tasks/detail?id=${task.id}`}
                className="block text-sm group-hover:text-foreground text-muted-foreground transition-colors"
              >
                {truncate(task.description, 60)}
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
