import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { fetchTaskLog } from "@/services/api";
import { EmptyState } from "@/components/ui/EmptyState";
import "./AgentLogViewer.css";

interface AgentLogViewerProps {
  taskId: string;
  wsLog?: string;
}

export function AgentLogViewer(props: AgentLogViewerProps) {
  const [log, setLog] = createSignal("");
  let containerRef: HTMLDivElement | undefined;
  let autoScroll = true;

  async function loadLog() {
    try {
      const data = await fetchTaskLog(props.taskId);
      setLog(data.log);
    } catch {
      // ignore
    }
  }

  createEffect(() => {
    loadLog();
    const timer = setInterval(loadLog, 3000);
    onCleanup(() => clearInterval(timer));
  });

  const displayLog = () => {
    const ws = props.wsLog;
    const base = log();
    return ws && ws.length > base.length ? ws : base;
  };

  createEffect(() => {
    displayLog();
    if (autoScroll && containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  });

  const handleScroll = () => {
    if (!containerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef;
    autoScroll = scrollHeight - scrollTop - clientHeight < 50;
  };

  const colorLine = (line: string) => {
    if (line.includes("ERROR") || line.includes("error") || line.includes("✗"))
      return "error";
    if (line.includes("SUCCESS") || line.includes("✓") || line.includes("success"))
      return "success";
    if (line.includes("WARN") || line.includes("warning"))
      return "warn";
    if (line.startsWith(">>>") || line.startsWith("---") || line.includes("Step"))
      return "step";
    return "";
  };

  return (
    <div class="agent-log">
      <div class="agent-log-header">
        <span class="agent-log-title">Agent Log</span>
      </div>
      <Show
        when={displayLog().length > 0}
        fallback={
          <div class="agent-log-body">
            <EmptyState text="No log output yet" icon="▸" />
          </div>
        }
      >
        <div class="agent-log-body" ref={containerRef} onScroll={handleScroll}>
          {displayLog()
            .split("\n")
            .map((line, i) => (
              <div class={`log-line ${colorLine(line)}`}>{line}</div>
            ))}
        </div>
      </Show>
    </div>
  );
}
