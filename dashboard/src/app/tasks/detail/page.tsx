"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TaskDetailClient } from "./task-detail-client";

function TaskDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">No task ID provided</p>
      </div>
    );
  }

  return <TaskDetailClient id={id} />;
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <TaskDetailInner />
    </Suspense>
  );
}
