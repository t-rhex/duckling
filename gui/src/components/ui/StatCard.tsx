import "./StatCard.css";

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
}

export function StatCard(props: StatCardProps) {
  return (
    <div class="stat-card">
      <div class="stat-card-label">{props.label}</div>
      <div class="stat-card-value" style={{ color: props.color }}>
        {props.value}
      </div>
    </div>
  );
}
