import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Button } from "@/components/ui/Button";
import { createTask } from "@/services/api";
import { TaskPriority, TaskMode } from "@/types/enums";
import { PRIORITY_LABELS, MODE_LABELS, MODE_DESCRIPTIONS } from "@/lib/constants";
import "./NewTaskForm.css";

export function NewTaskForm() {
  const navigate = useNavigate();
  const [description, setDescription] = createSignal("");
  const [repoUrl, setRepoUrl] = createSignal("");
  const [branch, setBranch] = createSignal("main");
  const [targetBranch, setTargetBranch] = createSignal("");
  const [priority, setPriority] = createSignal<TaskPriority>(TaskPriority.MEDIUM);
  const [mode, setMode] = createSignal<TaskMode>(TaskMode.CODE);
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [maxIterations, setMaxIterations] = createSignal(25);
  const [timeout, setTimeout] = createSignal(600);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  const descError = () =>
    description().length > 0 && description().length < 10
      ? "Description must be at least 10 characters"
      : "";

  const repoError = () => {
    const url = repoUrl();
    if (!url) return "";
    try {
      new URL(url);
      return "";
    } catch {
      return "Invalid URL";
    }
  };

  const canSubmit = () => {
    const base = description().length >= 10 && repoUrl().length > 0 && !repoError() && !submitting();
    if (mode() === TaskMode.PEER_REVIEW) {
      return base && targetBranch().length > 0;
    }
    return base;
  };

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    setError("");
    try {
      const task = await createTask({
        description: description(),
        repo_url: repoUrl(),
        branch: branch(),
        ...(mode() === TaskMode.PEER_REVIEW && targetBranch() ? { target_branch: targetBranch() } : {}),
        priority: priority(),
        mode: mode(),
        source: "web_ui" as never,
        max_iterations: maxIterations(),
        timeout_seconds: timeout(),
      });
      navigate(`/tasks/${task.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form class="new-task-form" onSubmit={handleSubmit}>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea
          class="form-textarea"
          placeholder="Describe the coding task in detail…"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
        />
        <Show when={descError()}>
          <div class="form-error">{descError()}</div>
        </Show>
        <div class="form-hint">Minimum 10 characters. Be specific about what you want changed.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Mode</label>
        <div class="mode-selector">
          {Object.values(TaskMode).map((m) => (
            <button
              type="button"
              class={`mode-option ${mode() === m ? "active" : ""}`}
              classList={{ review: m === TaskMode.REVIEW, "peer-review": m === TaskMode.PEER_REVIEW }}
              onClick={() => setMode(m)}
            >
              <span class="mode-icon">
                {m === TaskMode.CODE ? "{ }" : m === TaskMode.REVIEW ? "?" : "PR"}
              </span>
              <span class="mode-name">{MODE_LABELS[m]}</span>
              <span class="mode-desc">{MODE_DESCRIPTIONS[m]}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Repository URL</label>
          <input
            class="form-input"
            type="url"
            placeholder="https://github.com/org/repo"
            value={repoUrl()}
            onInput={(e) => setRepoUrl(e.currentTarget.value)}
          />
          <Show when={repoError()}>
            <div class="form-error">{repoError()}</div>
          </Show>
        </div>

        <div class="form-group">
          <label class="form-label">
            {mode() === TaskMode.PEER_REVIEW ? "Base Branch" : "Branch"}
          </label>
          <input
            class="form-input"
            placeholder="main"
            value={branch()}
            onInput={(e) => setBranch(e.currentTarget.value)}
          />
          <Show when={mode() === TaskMode.PEER_REVIEW}>
            <div class="form-hint">The branch to compare against</div>
          </Show>
        </div>
      </div>

      <Show when={mode() === TaskMode.PEER_REVIEW}>
        <div class="form-group">
          <label class="form-label">Target Branch (to review)</label>
          <input
            class="form-input"
            placeholder="feature/auth-refactor"
            value={targetBranch()}
            onInput={(e) => setTargetBranch(e.currentTarget.value)}
          />
          <div class="form-hint">Your coworker's branch that you want reviewed</div>
        </div>
      </Show>

      <div class="form-group">
        <label class="form-label">Priority</label>
        <select
          class="form-select"
          value={priority()}
          onChange={(e) => setPriority(e.currentTarget.value as TaskPriority)}
        >
          {Object.values(TaskPriority).map((p) => (
            <option value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div
        class="form-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced())}
      >
        <span>{showAdvanced() ? "▾" : "▸"}</span>
        Advanced Options
      </div>

      <Show when={showAdvanced()}>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Max Iterations</label>
            <input
              class="form-input"
              type="number"
              min="1"
              max="100"
              value={maxIterations()}
              onInput={(e) => setMaxIterations(parseInt(e.currentTarget.value) || 25)}
            />
          </div>
          <div class="form-group">
            <label class="form-label">Timeout (seconds)</label>
            <input
              class="form-input"
              type="number"
              min="60"
              max="3600"
              value={timeout()}
              onInput={(e) => setTimeout(parseInt(e.currentTarget.value) || 600)}
            />
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="form-error" style={{ "margin-bottom": "12px" }}>{error()}</div>
      </Show>

      <div class="form-actions">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!canSubmit()}
        >
          {submitting()
            ? "Submitting…"
            : mode() === TaskMode.PEER_REVIEW
              ? "Start Peer Review"
              : mode() === TaskMode.REVIEW
                ? "Start Review"
                : "Submit Task"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => navigate("/tasks")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
