import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TaskResponse } from "@/types/api";
import { TaskStatus } from "@/types/enums";
import { ACTIVE_STATUSES, STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatRelativeTime, repoName } from "@/lib/formatters";
import "./ActiveTasksFeed.css";

interface ActiveTasksFeedProps {
  tasks: TaskResponse[];
}

export function ActiveTasksFeed(props: ActiveTasksFeedProps) {
  const navigate = useNavigate();
  const activeTasks = () =>
    props.tasks.filter((t) => ACTIVE_STATUSES.has(t.status));

  return (
    <div class="active-feed">
      <div class="active-feed-header">
        <span class="active-feed-title">Active Tasks</span>
        <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
          {activeTasks().length}
        </span>
      </div>
      <div class="active-feed-body">
        <Show
          when={activeTasks().length > 0}
          fallback={<EmptyState text="No active tasks" icon="✓" />}
        >
          <For each={activeTasks()}>
            {(task) => (
              <div class="feed-item" onClick={() => navigate(`/tasks/${task.id}`)}>
                <span
                  class="feed-dot active"
                  style={{ background: STATUS_COLORS[task.status] }}
                />
                <div class="feed-info">
                  <div class="feed-desc">{task.description}</div>
                  <div class="feed-meta">
                    {repoName(task.repo_url)} · {STATUS_LABELS[task.status]} · {formatRelativeTime(task.created_at)}
                  </div>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
