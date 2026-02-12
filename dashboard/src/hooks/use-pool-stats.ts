"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { POLLING_INTERVALS } from "@/lib/constants";

export function usePoolStats() {
  return useQuery({
    queryKey: ["poolStats"],
    queryFn: api.getPoolStats,
    refetchInterval: POLLING_INTERVALS.pool,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: POLLING_INTERVALS.health,
  });
}
