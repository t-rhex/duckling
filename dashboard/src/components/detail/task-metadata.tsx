"use client";

import type { TaskResponse } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskModeBadge } from "@/components/tasks/task-mode-badge";
import { Separator } from "@/components/ui/separator";
import { GitBranch, Clock, User, ExternalLink } from "lucide-react";

interface TaskMetadataProps {
  task: TaskResponse;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function MetadataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Task Details</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MetadataRow label="Status">
          <TaskStatusBadge status={task.status} />
        </MetadataRow>

        <MetadataRow label="Mode">
          <TaskModeBadge mode={task.mode} />
        </MetadataRow>

        <MetadataRow label="Priority">
          <TaskPriorityBadge priority={task.priority} />
        </MetadataRow>

        <Separator />

        <MetadataRow label="Repository">
          <a
            href={task.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-amber-500 hover:underline truncate"
          >
            {task.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </MetadataRow>

        <MetadataRow label="Branch">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            {task.working_branch || task.branch}
          </span>
        </MetadataRow>

        <MetadataRow label="Source">
          <span className="capitalize">{task.source}</span>
        </MetadataRow>

        <MetadataRow label="Requester">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {task.requester_name || "Unknown"}
          </span>
        </MetadataRow>

        <Separator />

        <MetadataRow label="Created">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {new Date(task.created_at).toLocaleString()}
          </span>
        </MetadataRow>

        {task.duration_seconds != null && (
          <MetadataRow label="Duration">
            <span className="font-mono text-xs font-semibold">
              {formatDuration(task.duration_seconds)}
            </span>
          </MetadataRow>
        )}

        {/* PR Link */}
        {task.pr_url && (
          <>
            <Separator />
            <MetadataRow label="Pull Request">
              <a
                href={task.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:underline"
              >
                PR #{task.pr_number}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </MetadataRow>
          </>
        )}

        {/* Files Changed */}
        {task.files_changed.length > 0 && (
          <>
            <Separator />
            <MetadataRow label={`Files Changed (${task.files_changed.length})`}>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {task.files_changed.map((file) => (
                  <span
                    key={file}
                    className="font-mono text-xs text-muted-foreground truncate"
                    title={file}
                  >
                    {file}
                  </span>
                ))}
              </div>
            </MetadataRow>
          </>
        )}
      </CardContent>
    </Card>
  );
}
