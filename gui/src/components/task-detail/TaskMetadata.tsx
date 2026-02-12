import { Show } from "solid-js";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { TaskResponse } from "@/types/api";
import { TaskMode } from "@/types/enums";
import { MODE_LABELS } from "@/lib/constants";
import { formatDuration, repoName } from "@/lib/formatters";
import "./TaskMetadata.css";

interface TaskMetadataProps {
  task: TaskResponse;
}

export function TaskMetadata(props: TaskMetadataProps) {
  const isAnalysisMode = () =>
    props.task.mode === TaskMode.REVIEW || props.task.mode === TaskMode.PEER_REVIEW;
  const isPeerReview = () => props.task.mode === TaskMode.PEER_REVIEW;

  return (
    <div class="task-metadata">
      <div class="task-metadata-header">Details</div>
      <div class="task-metadata-body">
        <div class="meta-row">
          <span class="meta-label">Mode</span>
          <span class="meta-value" classList={{
            "meta-review": props.task.mode === TaskMode.REVIEW,
            "meta-peer-review": isPeerReview(),
          }}>
            {MODE_LABELS[props.task.mode]}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Repository</span>
          <span class="meta-value">
            <a href={props.task.repo_url} target="_blank">
              {repoName(props.task.repo_url)}
            </a>
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{isPeerReview() ? "Base Branch" : "Branch"}</span>
          <span class="meta-value">{props.task.branch}</span>
        </div>
        <Show when={props.task.target_branch}>
          <div class="meta-row">
            <span class="meta-label">Target Branch</span>
            <span class="meta-value meta-peer-review">{props.task.target_branch}</span>
          </div>
        </Show>
        <Show when={props.task.working_branch}>
          <div class="meta-row">
            <span class="meta-label">Working Branch</span>
            <span class="meta-value">{props.task.working_branch}</span>
          </div>
        </Show>
        <div class="meta-row">
          <span class="meta-label">Priority</span>
          <span class="meta-value">
            <PriorityBadge priority={props.task.priority} />
          </span>
        </div>
        <Show when={!isAnalysisMode()}>
          <div class="meta-row">
            <span class="meta-label">Iterations</span>
            <span class="meta-value">{props.task.iterations_used}</span>
          </div>
        </Show>
        <Show when={props.task.files_changed.length > 0}>
          <div class="meta-row">
            <span class="meta-label">Files Changed</span>
            <span class="meta-value">{props.task.files_changed.length}</span>
          </div>
        </Show>
        <div class="meta-row">
          <span class="meta-label">Duration</span>
          <span class="meta-value">{formatDuration(props.task.duration_seconds)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Source</span>
          <span class="meta-value">{props.task.source}</span>
        </div>
        <Show when={props.task.error_message}>
          <div class="meta-error">{props.task.error_message}</div>
        </Show>
      </div>
    </div>
  );
}
