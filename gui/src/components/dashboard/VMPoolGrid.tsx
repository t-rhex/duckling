import { For, Show } from "solid-js";
import { VMSlot } from "@/components/ui/VMSlot";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WarmPoolStats } from "@/types/api";
import { VMState } from "@/types/enums";
import "./VMPoolGrid.css";

interface VMPoolGridProps {
  stats: WarmPoolStats | null;
}

export function VMPoolGrid(props: VMPoolGridProps) {
  const slots = () => {
    if (!props.stats) return [];
    const result: VMState[] = [];
    for (let i = 0; i < props.stats.ready_vms; i++) result.push(VMState.READY);
    for (let i = 0; i < props.stats.claimed_vms; i++) result.push(VMState.CLAIMED);
    for (let i = 0; i < props.stats.creating_vms; i++) result.push(VMState.CREATING);
    for (let i = 0; i < props.stats.error_vms; i++) result.push(VMState.ERROR);
    return result;
  };

  return (
    <div class="vm-pool">
      <div class="vm-pool-header">
        <span class="vm-pool-title">VM Pool</span>
        <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
          {props.stats?.total_vms ?? 0} / {props.stats?.target_pool_size ?? 0}
        </span>
      </div>
      <div class="vm-pool-body">
        <Show when={slots().length > 0} fallback={<EmptyState text="No VMs" icon="▢" />}>
          <div class="vm-grid">
            <For each={slots()}>
              {(state) => <VMSlot state={state} />}
            </For>
          </div>
        </Show>
        <div class="vm-pool-legend">
          <div class="vm-legend-item">
            <span class="vm-legend-dot" style={{ background: "var(--accent-green)" }} />
            Ready
          </div>
          <div class="vm-legend-item">
            <span class="vm-legend-dot" style={{ background: "var(--accent-blue)" }} />
            Claimed
          </div>
          <div class="vm-legend-item">
            <span class="vm-legend-dot" style={{ background: "var(--text-muted)" }} />
            Creating
          </div>
          <div class="vm-legend-item">
            <span class="vm-legend-dot" style={{ background: "var(--accent-red)" }} />
            Error
          </div>
        </div>
      </div>
    </div>
  );
}
