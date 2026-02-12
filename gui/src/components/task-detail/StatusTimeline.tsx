import { For, createMemo } from "solid-js";
import { PIPELINE_STEPS, REVIEW_PIPELINE_STEPS, PEER_REVIEW_PIPELINE_STEPS } from "@/lib/constants";
import { TaskStatus, TaskMode } from "@/types/enums";
import "./StatusTimeline.css";

interface StatusTimelineProps {
  status: TaskStatus;
  mode?: TaskMode;
}

const STATUS_ORDER: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.CLAIMING_VM,
  TaskStatus.RUNNING,
  TaskStatus.TESTING,
  TaskStatus.CREATING_PR,
  TaskStatus.COMPLETED,
];

const SHORT_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.CLAIMING_VM,
  TaskStatus.RUNNING,
  TaskStatus.COMPLETED,
];

function getStepsForMode(mode?: TaskMode) {
  switch (mode) {
    case TaskMode.REVIEW: return REVIEW_PIPELINE_STEPS;
    case TaskMode.PEER_REVIEW: return PEER_REVIEW_PIPELINE_STEPS;
    default: return PIPELINE_STEPS;
  }
}

export function StatusTimeline(props: StatusTimelineProps) {
  const isShortPipeline = () => props.mode === TaskMode.REVIEW || props.mode === TaskMode.PEER_REVIEW;
  const steps = createMemo(() => getStepsForMode(props.mode));
  const statusOrder = createMemo(() => isShortPipeline() ? SHORT_STATUS_ORDER : STATUS_ORDER);

  const currentIndex = () => {
    if (props.status === TaskStatus.FAILED || props.status === TaskStatus.CANCELLED) {
      return statusOrder().indexOf(TaskStatus.COMPLETED);
    }
    return statusOrder().indexOf(props.status);
  };

  const isFailed = () =>
    props.status === TaskStatus.FAILED || props.status === TaskStatus.CANCELLED;

  return (
    <div class="status-timeline">
      <For each={steps()}>
        {(step, i) => {
          const stepIndex = () => i();
          const isCompleted = () => stepIndex() < currentIndex();
          const isActive = () => stepIndex() === currentIndex() && !isFailed();
          const isFailedStep = () => stepIndex() === currentIndex() && isFailed();

          return (
            <>
              {i() > 0 && (
                <div
                  class="timeline-connector"
                  classList={{ completed: isCompleted() }}
                />
              )}
              <div class="timeline-step">
                <div
                  class="timeline-node"
                  classList={{
                    completed: isCompleted(),
                    active: isActive(),
                    failed: isFailedStep(),
                  }}
                >
                  {isCompleted() ? "✓" : isFailedStep() ? "✕" : stepIndex() + 1}
                </div>
                <span
                  class="timeline-label"
                  classList={{ active: isActive(), completed: isCompleted() }}
                >
                  {step.label}
                </span>
              </div>
            </>
          );
        }}
      </For>
    </div>
  );
}
