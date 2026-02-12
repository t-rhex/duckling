"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { TaskTable } from "@/components/tasks/task-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskMode, TaskPriority } from "@/lib/types";

const PER_PAGE = 20;

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useTasks(page, PER_PAGE);

  // ── Client-side filters ──
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (modeFilter !== "all" && t.mode !== modeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [data?.tasks, statusFilter, modeFilter, priorityFilter]);

  const hasActiveFilters =
    statusFilter !== "all" || modeFilter !== "all" || priorityFilter !== "all";

  const filterSelectClasses =
    "h-8 w-[130px] bg-background/50 border-border/60 font-mono text-[10px] uppercase tracking-wider focus:ring-[var(--duckling-amber)]/30 focus:border-[var(--duckling-amber)]/50";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl uppercase tracking-widest text-foreground">
            Missions
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {isLoading
              ? "Loading\u2026"
              : isError
                ? "Error loading missions"
                : `${data?.total ?? 0} total`}
          </p>
        </div>
        <Button
          asChild
          className={cn(
            "bg-amber-500/90 hover:bg-amber-500 text-black",
            "font-mono text-xs uppercase tracking-wider",
            "rounded-sm h-9 px-4"
          )}
        >
          <Link href="/tasks/new">
            <Plus className="h-3.5 w-3.5" />
            New Mission
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Filter
        </span>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className={filterSelectClasses}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="creating_pr">Creating PR</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
          <SelectTrigger className={filterSelectClasses}>
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="code">Code</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="peer_review">Peer Review</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className={filterSelectClasses}>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter("all"); setModeFilter("all"); setPriorityFilter("all"); }}
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--duckling-amber)] hover:text-[var(--duckling-amber)]/80 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="stagger-children space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              <Skeleton className="h-11 w-full rounded-sm" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-dashed border-red-500/20">
          <p className="font-mono text-xs text-red-400 uppercase tracking-wider">
            Mission control offline:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      ) : (
        <div className="animate-fade-in-up">
          <TaskTable
            tasks={hasActiveFilters ? filteredTasks : (data?.tasks ?? [])}
            total={hasActiveFilters ? filteredTasks.length : (data?.total ?? 0)}
            page={hasActiveFilters ? 1 : page}
            perPage={hasActiveFilters ? filteredTasks.length || 1 : PER_PAGE}
            onPageChange={setPage}
            hidePageControls={hasActiveFilters}
          />
        </div>
      )}
    </div>
  );
}
