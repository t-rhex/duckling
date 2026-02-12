import { TaskStatus, TaskPriority } from "@/types/enums";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import "./TaskFilters.css";

interface TaskFiltersProps {
  status: string;
  priority: string;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
}

export function TaskFilters(props: TaskFiltersProps) {
  return (
    <div class="task-filters">
      <select
        class="task-filter-select"
        value={props.status}
        onChange={(e) => props.onStatusChange(e.currentTarget.value)}
      >
        <option value="">All Statuses</option>
        {Object.values(TaskStatus).map((s) => (
          <option value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <select
        class="task-filter-select"
        value={props.priority}
        onChange={(e) => props.onPriorityChange(e.currentTarget.value)}
      >
        <option value="">All Priorities</option>
        {Object.values(TaskPriority).map((p) => (
          <option value={p}>{PRIORITY_LABELS[p]}</option>
        ))}
      </select>
    </div>
  );
}
