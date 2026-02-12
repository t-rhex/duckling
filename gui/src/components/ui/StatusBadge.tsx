import { TaskStatus } from "@/types/enums";
import { STATUS_COLORS, STATUS_LABELS, ACTIVE_STATUSES } from "@/lib/constants";
import "./StatusBadge.css";

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge(props: StatusBadgeProps) {
  const color = () => STATUS_COLORS[props.status];
  const label = () => STATUS_LABELS[props.status];
  const isActive = () => ACTIVE_STATUSES.has(props.status);

  return (
    <span class="status-badge" style={{ background: `${color()}15`, color: color() }}>
      <span
        class="status-badge-dot"
        classList={{ pulse: isActive() }}
        style={{ background: color() }}
      />
      {label()}
    </span>
  );
}
