import "./EmptyState.css";

interface EmptyStateProps {
  icon?: string;
  text: string;
  subtext?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div class="empty-state">
      <div class="empty-state-icon">{props.icon || "∅"}</div>
      <div class="empty-state-text">{props.text}</div>
      {props.subtext && <div class="empty-state-sub">{props.subtext}</div>}
    </div>
  );
}
