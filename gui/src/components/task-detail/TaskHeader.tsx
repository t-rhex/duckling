import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TaskResponse } from "@/types/api";
import { formatDuration, formatRelativeTime } from "@/lib/formatters";
import "./TaskHeader.css";

interface TaskHeaderProps {
  task: TaskResponse;
}

export function TaskHeader(props: TaskHeaderProps) {
  return (
    <div class="task-header">
      <div class="task-header-left">
        <h1 class="task-header-title">{props.task.description}</h1>
        <div class="task-header-timing">
          <span>Created {formatRelativeTime(props.task.created_at)}</span>
          <span>Duration: {formatDuration(props.task.duration_seconds)}</span>
        </div>
      </div>
      <StatusBadge status={props.task.status} />
    </div>
  );
}
