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
    // The scroll-area viewport is the first child with overflow
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
      <ScrollArea className="h-[500px] rounded-lg bg-zinc-950 border border-zinc-800">
        <div className="p-4 font-mono text-xs leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span
                className="select-none pr-4 text-right text-zinc-600"
                style={{ minWidth: `${lineNumberWidth + 1}ch` }}
              >
                {i + 1}
              </span>
              <span className="text-emerald-400/80 whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      <div
        className={cn(
          "absolute bottom-4 right-4 transition-opacity duration-200",
          isAtBottom ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={scrollToBottom}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shadow-lg"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Live
          </span>
        </div>
      )}
    </div>
  );
}
