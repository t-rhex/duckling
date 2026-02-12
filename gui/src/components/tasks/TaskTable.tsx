import { For, Show } from "solid-js";
import { TaskRow } from "./TaskRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TaskResponse } from "@/types/api";
import "./TaskTable.css";

interface TaskTableProps {
  tasks: TaskResponse[];
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
}

export function TaskTable(props: TaskTableProps) {
  const sortIcon = (field: string) => {
    if (props.sortField !== field) return "";
    return props.sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div class="task-table-wrapper">
      <Show
        when={props.tasks.length > 0}
        fallback={<EmptyState text="No tasks found" subtext="Try adjusting your filters" />}
      >
        <table class="task-table">
          <thead>
            <tr>
              <th classList={{ sorted: props.sortField === "status" }} onClick={() => props.onSort("status")}>
                Status{sortIcon("status")}
              </th>
              <th classList={{ sorted: props.sortField === "description" }} onClick={() => props.onSort("description")}>
                Description{sortIcon("description")}
              </th>
              <th classList={{ sorted: props.sortField === "repo_url" }} onClick={() => props.onSort("repo_url")}>
                Repository{sortIcon("repo_url")}
              </th>
              <th>Mode</th>
              <th classList={{ sorted: props.sortField === "priority" }} onClick={() => props.onSort("priority")}>
                Priority{sortIcon("priority")}
              </th>
              <th classList={{ sorted: props.sortField === "created_at" }} onClick={() => props.onSort("created_at")}>
                Created{sortIcon("created_at")}
              </th>
              <th classList={{ sorted: props.sortField === "duration_seconds" }} onClick={() => props.onSort("duration_seconds")}>
                Duration{sortIcon("duration_seconds")}
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={props.tasks}>
              {(task) => <TaskRow task={task} />}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
