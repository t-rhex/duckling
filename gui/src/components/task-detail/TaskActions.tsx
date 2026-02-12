import { Show, createSignal } from "solid-js";
import { Button } from "@/components/ui/Button";
import { cancelTask } from "@/services/api";
import type { TaskResponse } from "@/types/api";
import { CANCELABLE_STATUSES } from "@/lib/constants";
import { TaskStatus } from "@/types/enums";
import "./TaskActions.css";

interface TaskActionsProps {
  task: TaskResponse;
  onCancelled: () => void;
}

export function TaskActions(props: TaskActionsProps) {
  const [cancelling, setCancelling] = createSignal(false);

  const canCancel = () => CANCELABLE_STATUSES.has(props.task.status);
  const hasPR = () => props.task.status === TaskStatus.COMPLETED && props.task.pr_url;

  async function handleCancel() {
    if (!confirm("Cancel this task?")) return;
    setCancelling(true);
    try {
      await cancelTask(props.task.id);
      props.onCancelled();
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div class="task-actions">
      <Show when={canCancel()}>
        <Button
          variant="danger"
          size="sm"
          disabled={cancelling()}
          onClick={handleCancel}
        >
          {cancelling() ? "Cancelling…" : "Cancel Task"}
        </Button>
      </Show>
      <Show when={hasPR()}>
        <a href={props.task.pr_url!} target="_blank">
          <Button variant="primary" size="sm">
            View PR #{props.task.pr_number}
          </Button>
        </a>
      </Show>
    </div>
  );
}
