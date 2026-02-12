import { createSignal, onCleanup } from "solid-js";
import { fetchHealth } from "@/services/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { HealthResponse } from "@/types/api";

const [isConnected, setIsConnected] = createSignal(false);
const [healthData, setHealthData] = createSignal<HealthResponse | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function checkHealth() {
  try {
    const data = await fetchHealth();
    setHealthData(data);
    setIsConnected(true);
  } catch {
    setIsConnected(false);
    setHealthData(null);
  }
}

export function startHealthPolling() {
  checkHealth();
  pollTimer = setInterval(checkHealth, POLL_INTERVAL_MS);
}

export function stopHealthPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function useConnection() {
  startHealthPolling();
  onCleanup(stopHealthPolling);
  return { isConnected, healthData, checkHealth };
}

export { isConnected, healthData };
