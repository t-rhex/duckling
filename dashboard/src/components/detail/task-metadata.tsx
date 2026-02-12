"use client";

import type { TaskResponse } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskModeBadge } from "@/components/tasks/task-mode-badge";
import { Separator } from "@/components/ui/separator";
import { formatDuration } from "@/lib/format";
import { GitBranch, Clock, User, ExternalLink, FileCode2, AlertTriangle } from "lucide-react";

interface TaskMetadataProps {
  task: TaskResponse;
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
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Details
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MetadataRow label="Status">
          <TaskStatusBadge status={task.status} />
        </MetadataRow>

        {/* Error message for failed tasks */}
        {task.status === "failed" && task.error_message && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
            <p className="font-mono text-xs text-red-400 leading-relaxed">
              {task.error_message}
            </p>
          </div>
        )}

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
            className="inline-flex items-center gap-1.5 truncate font-mono text-sm text-[var(--duckling-amber)] hover:underline"
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
          <span className="font-mono text-xs capitalize">{task.source.replace(/_/g, " ")}</span>
        </MetadataRow>

        <MetadataRow label="Requester">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {task.requester_name || "Unknown"}
          </span>
        </MetadataRow>

        <Separator />

        <MetadataRow label="Created">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {new Date(task.created_at).toLocaleString()}
          </span>
        </MetadataRow>

        {task.duration_seconds != null && (
          <MetadataRow label="Duration">
            <span className="font-mono text-xs font-semibold text-[var(--duckling-amber)]">
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
                className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--duckling-amber)] hover:underline"
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
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {task.files_changed.map((file) => (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground"
                    title={file}
                  >
                    <FileCode2 className="h-3 w-3 shrink-0 text-zinc-600" />
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
