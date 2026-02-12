import { apiUrl } from "@/stores/settings";
import { WS_PING_INTERVAL_MS } from "@/lib/constants";
import type { WSMessage } from "@/types/api";

export type WSCallback = (msg: WSMessage) => void;

export class TaskWebSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private taskId: string;
  private onMessage: WSCallback;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(taskId: string, onMessage: WSCallback) {
    this.taskId = taskId;
    this.onMessage = onMessage;
  }

  connect() {
    const base = apiUrl().replace(/^http/, "ws");
    this.ws = new WebSocket(`${base}/ws/tasks/${this.taskId}`);

    this.ws.onopen = () => {
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send("ping");
        }
      }, WS_PING_INTERVAL_MS);
    };

    this.ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.onMessage(msg);
      } catch {
        // ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private cleanup() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
