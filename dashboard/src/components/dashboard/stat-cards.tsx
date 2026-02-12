"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, Server, Timer } from "lucide-react";

interface StatCardsProps {
  activeTasks: number;
  completedTasks: number;
  readyVMs: number;
  avgClaimTime: number;
}

const stats = [
  {
    key: "active",
    label: "Active Tasks",
    icon: Activity,
    iconColor: "text-amber-500",
    getValue: (p: StatCardsProps) => p.activeTasks,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    getValue: (p: StatCardsProps) => p.completedTasks,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "vms",
    label: "VMs Ready",
    icon: Server,
    iconColor: "text-blue-500",
    getValue: (p: StatCardsProps) => p.readyVMs,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "claim",
    label: "Avg Claim Time",
    icon: Timer,
    iconColor: "text-violet-500",
    getValue: (p: StatCardsProps) => p.avgClaimTime,
    format: (v: number) => `${v.toLocaleString()}ms`,
  },
] as const;

export function StatCards(props: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ key, label, icon: Icon, iconColor, getValue, format }) => {
        const value = getValue(props);
        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-mono font-semibold tracking-tight">
                {format(value)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
