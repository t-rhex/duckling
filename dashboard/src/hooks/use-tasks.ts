"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { TaskCreate } from "@/lib/types";
import { POLLING_INTERVALS } from "@/lib/constants";

export function useTasks(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ["tasks", page, perPage],
    queryFn: () => api.listTasks(page, perPage),
    refetchInterval: POLLING_INTERVALS.tasks,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.getTask(id),
    refetchInterval: POLLING_INTERVALS.taskDetail,
    enabled: !!id,
  });
}

export function useTaskLog(id: string, enabled = true) {
  return useQuery({
    queryKey: ["taskLog", id],
    queryFn: () => api.getTaskLog(id),
    refetchInterval: POLLING_INTERVALS.taskDetail,
    enabled: !!id && enabled,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreate) => api.createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCancelTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
