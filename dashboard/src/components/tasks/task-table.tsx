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
import type { TaskResponse } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

// ── Component ────────────────────────────────────────────────

interface TaskTableProps {
  tasks: TaskResponse[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export function TaskTable({
  tasks,
  total,
  page,
  perPage,
  onPageChange,
}: TaskTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (tasks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No tasks found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Mode</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[90px] text-right">Duration</TableHead>
              <TableHead className="w-[90px] text-right">Created</TableHead>
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
                    className="block text-sm text-muted-foreground transition-colors group-hover:text-foreground"
                  >
                    {truncate(task.description, 80)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/tasks/detail?id=${task.id}`} className="block">
                    <TaskModeBadge mode={task.mode} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/tasks/detail?id=${task.id}`} className="block">
                    <TaskPriorityBadge priority={task.priority} />
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block font-mono text-xs text-muted-foreground"
                  >
                    {formatDuration(task.duration_seconds)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/tasks/detail?id=${task.id}`}
                    className="block font-mono text-xs text-muted-foreground"
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
