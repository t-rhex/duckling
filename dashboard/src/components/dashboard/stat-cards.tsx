"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Rocket, Server, Timer, ShieldCheck } from "lucide-react";

interface StatCardsProps {
  totalMissions: number;
  readyVMs: number;
  avgClaimTime: number;
  isHealthy: boolean;
}

const stats = [
  {
    key: "total",
    label: "TOTAL MISSIONS",
    icon: Rocket,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    borderColor: "border-l-amber-500",
    getValue: (p: StatCardsProps) => p.totalMissions,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "vms",
    label: "VMS READY",
    icon: Server,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    borderColor: "border-l-blue-500",
    getValue: (p: StatCardsProps) => p.readyVMs,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "claim",
    label: "AVG CLAIM",
    icon: Timer,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    borderColor: "border-l-violet-500",
    getValue: (p: StatCardsProps) => p.avgClaimTime,
    format: (v: number) => `${v.toLocaleString()}ms`,
  },
  {
    key: "health",
    label: "SYSTEM HEALTH",
    icon: ShieldCheck,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    borderColor: "border-l-emerald-500",
    getValue: (p: StatCardsProps) => (p.isHealthy ? 1 : 0),
    format: (_v: number, p: StatCardsProps) =>
      p.isHealthy ? "Nominal" : "Offline",
  },
] as const;

export function StatCards(props: StatCardsProps) {
  return (
    <div className="stagger-children grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(
        ({
          key,
          label,
          icon: Icon,
          iconColor,
          iconBg,
          borderColor,
          getValue,
          format,
        }) => {
          const value = getValue(props);
          return (
            <Card
              key={key}
              className={cn(
                "card-hover relative border-l-2 py-5",
                borderColor
              )}
            >
              <CardContent className="px-5">
                {/* Icon — top right with accent bg circle */}
                <div className="absolute right-4 top-4">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      iconBg
                    )}
                  >
                    <Icon className={cn("h-4 w-4", iconColor)} />
                  </div>
                </div>

                {/* Value — huge mono number (or label for health) */}
                <p
                  className={cn(
                    "font-mono font-bold tracking-tight",
                    key === "health" ? "text-2xl" : "text-4xl"
                  )}
                >
                  {format(value, props)}
                </p>

                {/* Label — tiny mono uppercase */}
                <p className="mt-1.5 text-[10px] font-mono font-medium uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </CardContent>
            </Card>
          );
        }
      )}
    </div>
  );
}
