import { useNavigate } from "@solidjs/router";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { TaskResponse } from "@/types/api";
import { TaskMode } from "@/types/enums";
import { MODE_LABELS } from "@/lib/constants";
import { formatDuration, formatRelativeTime, repoName, truncate } from "@/lib/formatters";

interface TaskRowProps {
  task: TaskResponse;
}

export function TaskRow(props: TaskRowProps) {
  const navigate = useNavigate();

  return (
    <tr onClick={() => navigate(`/tasks/${props.task.id}`)}>
      <td>
        <StatusBadge status={props.task.status} />
      </td>
      <td class="col-desc">{truncate(props.task.description, 60)}</td>
      <td class="col-repo">{repoName(props.task.repo_url)}</td>
      <td class="col-mode">
        <span classList={{ "mode-tag": true, review: props.task.mode === TaskMode.REVIEW, "peer-review": props.task.mode === TaskMode.PEER_REVIEW }}>
          {MODE_LABELS[props.task.mode]}
        </span>
      </td>
      <td>
        <PriorityBadge priority={props.task.priority} />
      </td>
      <td class="col-time">{formatRelativeTime(props.task.created_at)}</td>
      <td class="col-time">{formatDuration(props.task.duration_seconds)}</td>
    </tr>
  );
}
