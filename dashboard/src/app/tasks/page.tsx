"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { TaskTable } from "@/components/tasks/task-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PER_PAGE = 20;

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useTasks(page, PER_PAGE);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl uppercase tracking-widest text-foreground">
            Tasks
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {isLoading
              ? "Loading\u2026"
              : isError
                ? "Error loading tasks"
                : `${data?.total ?? 0} total missions`}
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
            New Task
          </Link>
        </Button>
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
            tasks={data?.tasks ?? []}
            total={data?.total ?? 0}
            page={page}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
