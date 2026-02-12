import "./ConnectionDot.css";

interface ConnectionDotProps {
  connected: boolean;
}

export function ConnectionDot(props: ConnectionDotProps) {
  return (
    <span
      class="connection-dot"
      classList={{ connected: props.connected, disconnected: !props.connected }}
    />
  );
}
