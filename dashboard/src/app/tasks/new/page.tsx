"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCreateTask } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskCreate, TaskMode, TaskPriority } from "@/lib/types";

export default function NewTaskPage() {
  const router = useRouter();
  const createTask = useCreateTask();

  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [targetBranch, setTargetBranch] = useState("");
  const [mode, setMode] = useState<string>("auto");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [maxIterations, setMaxIterations] = useState(25);
  const [timeout, setTimeout] = useState(600);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (description.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    if (!repoUrl.trim()) {
      toast.error("Repository URL is required");
      return;
    }

    const payload: TaskCreate = {
      description: description.trim(),
      repo_url: repoUrl.trim(),
      branch: branch.trim() || "main",
      target_branch: targetBranch.trim() || null,
      mode: mode === "auto" ? null : (mode as TaskMode),
      priority,
      max_iterations: maxIterations,
      timeout_seconds: timeout,
      source: "web_ui",
    };

    createTask.mutate(payload, {
      onSuccess: (task) => {
        toast.success("Mission created");
        router.push(`/tasks/detail?id=${task.id}`);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to create mission"
        );
      },
    });
  }

  const labelClasses =
    "font-mono text-[10px] uppercase tracking-widest text-muted-foreground";

  const inputClasses =
    "bg-background/50 border-border/60 font-mono text-sm placeholder:text-muted-foreground/40 focus-visible:ring-[var(--duckling-amber)]/30 focus-visible:border-[var(--duckling-amber)]/50 transition-colors";

  const selectTriggerClasses =
    "bg-background/50 border-border/60 font-mono text-sm focus:ring-[var(--duckling-amber)]/30 focus:border-[var(--duckling-amber)]/50 transition-colors";

  return (
    <div className="mx-auto max-w-2xl py-6 animate-fade-in-up">
      <Card className="card-hover">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--duckling-amber-soft)] border border-[var(--duckling-amber)]/20">
              <Plus className="h-4 w-4 text-[var(--duckling-amber)]" />
            </div>
            <CardTitle className="font-mono text-sm uppercase tracking-widest text-foreground">
              New Mission
            </CardTitle>
          </div>
          <CardDescription className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
            Describe what you want the agent to do. It will clone the repo,
            execute the task, and open a pull request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className={labelClasses}>
                Mission Brief
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what you want the agent to do..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                rows={4}
                className={`${inputClasses} resize-none`}
              />
            </div>

            {/* Repo URL */}
            <div className="space-y-2">
              <Label htmlFor="repo-url" className={labelClasses}>
                Repository URL
              </Label>
              <Input
                id="repo-url"
                type="url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                className={inputClasses}
              />
            </div>

            {/* Branch + Target Branch */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch" className={labelClasses}>
                  Branch
                </Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-branch" className={labelClasses}>
                  Target Branch
                </Label>
                <Input
                  id="target-branch"
                  placeholder="Optional (for peer review)"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Mode + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={labelClasses}>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className={selectTriggerClasses}>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent className="font-mono text-sm">
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="peer_review">Peer Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className={labelClasses}>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger className={selectTriggerClasses}>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="font-mono text-sm">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Max Iterations + Timeout */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-iterations" className={labelClasses}>
                  Max Iterations
                </Label>
                <Input
                  id="max-iterations"
                  type="number"
                  min={1}
                  max={100}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout" className={labelClasses}>
                  Timeout (seconds)
                </Label>
                <Input
                  id="timeout"
                  type="number"
                  min={60}
                  max={3600}
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-[var(--duckling-amber)] text-black font-mono uppercase tracking-wider hover:bg-[var(--duckling-amber)]/90 hover:glow-amber transition-all duration-200 h-11"
              disabled={createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--duckling-amber)]" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {createTask.isPending ? "Launching..." : "Launch Mission"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
