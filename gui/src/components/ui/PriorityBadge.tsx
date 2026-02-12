import { TaskPriority } from "@/types/enums";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import "./PriorityBadge.css";

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge(props: PriorityBadgeProps) {
  const color = () => PRIORITY_COLORS[props.priority];
  const label = () => PRIORITY_LABELS[props.priority];

  return (
    <span class="priority-badge" style={{ color: color() }}>
      <span class="priority-badge-dot" style={{ background: color() }} />
      {label()}
    </span>
  );
}
