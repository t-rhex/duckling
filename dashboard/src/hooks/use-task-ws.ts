"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "@/lib/constants";
import type { WSEvent } from "@/lib/types";

export function useTaskWebSocket(taskId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WSEvent[]>([]);

  const connect = useCallback(() => {
    if (!taskId) return;

    const ws = new WebSocket(`${WS_URL}/ws/tasks/${taskId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WSEvent;
        setEvents((prev) => [...prev, data]);
      } catch {
        // Ignore pong / non-JSON
      }
    };
  }, [taskId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  // Keepalive ping every 30s
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => {
      wsRef.current?.send("ping");
    }, 30_000);
    return () => clearInterval(id);
  }, [connected]);

  return { connected, events };
}
