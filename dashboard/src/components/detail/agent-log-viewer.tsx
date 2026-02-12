"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentLogViewerProps {
  log: string;
  isLive?: boolean;
}

export function AgentLogViewer({ log, isLive = false }: AgentLogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const lines = log.split("\n");
  const lineNumberWidth = String(lines.length).length;

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsAtBottom(atBottom);
  }, []);

  // Auto-scroll when live and new content arrives
  useEffect(() => {
    if (isLive && isAtBottom) {
      scrollToBottom();
    }
  }, [log, isLive, isAtBottom, scrollToBottom]);

  // Attach scroll listener
  useEffect(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative" ref={containerRef}>
      <ScrollArea
        className={cn(
          "h-[500px] rounded-lg bg-[#0C0A09]",
          "border border-[rgba(251,191,36,0.08)]"
        )}
      >
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(251,191,36,0.015) 2px, rgba(251,191,36,0.015) 4px)",
            backgroundSize: "100% 4px",
          }}
        />

        <div className="relative z-0 p-4 font-mono text-xs leading-relaxed">
          {log.trim() === "" ? (
            <div className="flex items-center justify-center h-32">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <span className="status-dot-pulse h-2 w-2 rounded-full bg-[var(--duckling-amber)]" />
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px]">
                    Waiting for agent output...
                  </span>
                </div>
              ) : (
                <span className="text-zinc-600 uppercase tracking-wider text-[10px]">
                  No log output recorded
                </span>
              )}
            </div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="flex">
                <span
                  className="select-none pr-4 text-right text-zinc-600"
                  style={{ minWidth: `${lineNumberWidth + 1}ch` }}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap break-all text-green-400/90">
                  {line}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Scroll-to-bottom button */}
      <div
        className={cn(
          "absolute bottom-4 right-4 z-20 transition-opacity duration-200",
          isAtBottom ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={scrollToBottom}
          className="bg-zinc-800 text-zinc-300 shadow-lg hover:bg-zinc-700"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <span className="status-dot-pulse h-2 w-2 rounded-full bg-[var(--duckling-amber)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Live
          </span>
        </div>
      )}
    </div>
  );
}
