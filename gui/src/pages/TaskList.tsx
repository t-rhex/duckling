import { createSignal, createEffect, onCleanup } from "solid-js";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskTable } from "@/components/tasks/TaskTable";
import { TaskPagination } from "@/components/tasks/TaskPagination";
import { fetchTasks } from "@/services/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { TaskResponse } from "@/types/api";

export default function TaskList() {
  const [tasks, setTasks] = createSignal<TaskResponse[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [statusFilter, setStatusFilter] = createSignal("");
  const [priorityFilter, setPriorityFilter] = createSignal("");
  const [sortField, setSortField] = createSignal("created_at");
  const [sortDir, setSortDir] = createSignal<"asc" | "desc">("desc");

  const perPage = 20;
  const totalPages = () => Math.max(1, Math.ceil(total() / perPage));

  async function loadTasks() {
    try {
      const data = await fetchTasks(page(), perPage);
      setTasks(data.tasks);
      setTotal(data.total);
    } catch {
      // connection may be down
    }
  }

  createEffect(() => {
    loadTasks();
    const timer = setInterval(loadTasks, POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  const filteredTasks = () => {
    let result = tasks();
    const sf = statusFilter();
    const pf = priorityFilter();
    if (sf) result = result.filter((t) => t.status === sf);
    if (pf) result = result.filter((t) => t.priority === pf);
    return result;
  };

  const sortedTasks = () => {
    const field = sortField();
    const dir = sortDir();
    return [...filteredTasks()].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[field];
      const bVal = (b as Record<string, unknown>)[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal));
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const handleSort = (field: string) => {
    if (sortField() === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div class="animate-in" style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      <TaskFilters
        status={statusFilter()}
        priority={priorityFilter()}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
      />
      <TaskTable
        tasks={sortedTasks()}
        sortField={sortField()}
        sortDir={sortDir()}
        onSort={handleSort}
      />
      <TaskPagination
        page={page()}
        totalPages={totalPages()}
        onPageChange={setPage}
      />
    </div>
  );
}
