"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
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
        toast.success("Task created");
        router.push(`/tasks/detail?id=${task.id}`);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to create task"
        );
      },
    });
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card>
        <CardHeader>
          <CardTitle>New Task</CardTitle>
          <CardDescription>
            Describe what you want the agent to do. It will clone the repo,
            execute the task, and open a pull request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what you want the agent to do..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                rows={4}
              />
            </div>

            {/* Repo URL */}
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                type="url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
            </div>

            {/* Branch + Target Branch */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-branch">Target Branch</Label>
                <Input
                  id="target-branch"
                  placeholder="Optional (for peer review)"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                />
              </div>
            </div>

            {/* Mode + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="peer_review">Peer Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label htmlFor="max-iterations">Max Iterations</Label>
                <Input
                  id="max-iterations"
                  type="number"
                  min={1}
                  max={100}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={60}
                  max={3600}
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
