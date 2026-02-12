"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { TaskTable } from "@/components/tasks/task-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PER_PAGE = 20;

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useTasks(page, PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your agent tasks
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-destructive">
            Failed to load tasks:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      ) : (
        <TaskTable
          tasks={data?.tasks ?? []}
          total={data?.total ?? 0}
          page={page}
          perPage={PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
