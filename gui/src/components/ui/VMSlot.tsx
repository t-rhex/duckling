import { VMState } from "@/types/enums";
import { VM_STATE_COLORS } from "@/lib/constants";
import "./VMSlot.css";

interface VMSlotProps {
  state: VMState;
}

export function VMSlot(props: VMSlotProps) {
  const color = () => VM_STATE_COLORS[props.state];
  const isActive = () =>
    props.state === VMState.CLAIMED || props.state === VMState.RUNNING;

  return (
    <div
      class="vm-slot"
      classList={{ active: isActive() }}
      style={{ background: color() }}
      title={props.state}
    />
  );
}
