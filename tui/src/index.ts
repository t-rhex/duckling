/**
 * Duckling TUI — main entry point.
 *
 * A beautiful terminal interface for the Duckling autonomous coding agent.
 *
 * Usage:
 *   bun src/index.ts                      # connect to localhost:8000
 *   bun src/index.ts --url http://host:8000
 *
 * Screens:
 *   [1] Dashboard — overview, pool stats, recent tasks
 *   [2] New Task  — submit a new coding task
 *   [3] Tasks     — browse and inspect all tasks
 *   [q] Quit
 */

import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";
import { DucklingAPI } from "./api.js";
import { theme } from "./theme.js";
import { addAll } from "./util.js";
import { Header } from "./screens/header.js";
import { DashboardScreen } from "./screens/dashboard.js";
import { NewTaskScreen } from "./screens/new-task.js";
import { TaskListScreen } from "./screens/task-list.js";
import { TaskDetailScreen } from "./screens/task-detail.js";
import { createFooter } from "./screens/footer.js";

// ── Parse CLI args ────────────────────────────────────────────────

function parseArgs(): { url: string } {
  const args = process.argv.slice(2);
  let url = "http://localhost:8000";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = args[i + 1];
      i++;
    }
  }

  return { url };
}

// ── App State ─────────────────────────────────────────────────────

type Screen = "dashboard" | "new-task" | "task-list" | "task-detail";

interface AppState {
  currentScreen: Screen;
  previousScreen: Screen;
  selectedTaskId: string | null;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const { url } = parseArgs();
  const api = new DucklingAPI(url);

  // Create renderer
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    useMouse: true,
    onDestroy: () => {
      header.stopPolling();
      dashboard.stopPolling();
      taskList.stopPolling();
      taskDetail.stopPolling();
    },
  });

  // ── Initialize screens ──────────────────────────────────────

  const header = new Header(renderer, api);
  const dashboard = new DashboardScreen(renderer, api);
  const newTask = new NewTaskScreen(renderer, api);
  const taskList = new TaskListScreen(renderer, api);
  const taskDetail = new TaskDetailScreen(renderer, api);
  const footer = createFooter(renderer);

  // ── App state ───────────────────────────────────────────────

  const state: AppState = {
    currentScreen: "dashboard",
    previousScreen: "dashboard",
    selectedTaskId: null,
  };

  // ── Screen container ────────────────────────────────────────

  const screenContainer = new BoxRenderable(renderer, {
    id: "screen-container",
    flexGrow: 1,
    width: "100%",
  });

  // ── App layout ──────────────────────────────────────────────

  const appLayout = new BoxRenderable(renderer, {
    id: "app",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: theme.bg,
  });

  addAll(appLayout, header.container, screenContainer, footer);
  renderer.root.add(appLayout);

  // ── Screen map ──────────────────────────────────────────────

  const screens: Record<Screen, BoxRenderable> = {
    dashboard: dashboard.container,
    "new-task": newTask.container,
    "task-list": taskList.container,
    "task-detail": taskDetail.container,
  };

  // ── Screen switching ────────────────────────────────────────

  function switchScreen(screen: Screen) {
    // Stop polling on old screen
    switch (state.currentScreen) {
      case "dashboard":
        dashboard.stopPolling();
        break;
      case "task-list":
        taskList.stopPolling();
        break;
      case "task-detail":
        taskDetail.stopPolling();
        break;
    }

    // Remove current screen
    const currentNode = screens[state.currentScreen];
    try {
      screenContainer.remove(currentNode.id);
    } catch {
      // May not be added yet on first call
    }

    state.previousScreen = state.currentScreen;
    state.currentScreen = screen;

    // Add new screen
    screenContainer.add(screens[screen]);

    // Start polling / focus on new screen
    switch (screen) {
      case "dashboard":
        dashboard.startPolling();
        break;
      case "new-task":
        newTask.focus();
        break;
      case "task-list":
        taskList.startPolling();
        taskList.focus();
        break;
      case "task-detail":
        if (state.selectedTaskId) {
          taskDetail.setTask(state.selectedTaskId);
        }
        taskDetail.startPolling();
        taskDetail.focus();
        break;
    }
  }

  // ── Keyboard navigation ─────────────────────────────────────

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    // Global navigation (not in text input mode)
    if (state.currentScreen !== "new-task") {
      switch (key.name) {
        case "1":
          switchScreen("dashboard");
          return;
        case "2":
          switchScreen("new-task");
          return;
        case "3":
          switchScreen("task-list");
          return;
        case "q":
          renderer.destroy();
          process.exit(0);
          return;
      }
    }

    // Escape key handling
    if (key.name === "escape") {
      if (state.currentScreen === "task-detail") {
        switchScreen("task-list");
      } else if (state.currentScreen === "new-task") {
        switchScreen("dashboard");
      }
    }

    // Tab in new-task form
    if (state.currentScreen === "new-task" && key.name === "tab") {
      if (key.shift) {
        newTask.focusPrev();
      } else {
        newTask.focusNext();
      }
    }

    // Ctrl+S for submit
    if (state.currentScreen === "new-task" && key.ctrl && key.name === "s") {
      newTask.submit();
    }

    // 'r' to refresh on task-list
    if (state.currentScreen === "task-list" && key.name === "r") {
      taskList.refresh();
    }
  });

  // ── Wire callbacks ──────────────────────────────────────────

  newTask.setOnSubmit((task) => {
    state.selectedTaskId = task.id;
    switchScreen("task-detail");
  });

  taskList.setOnTaskSelect((task) => {
    state.selectedTaskId = task.id;
    switchScreen("task-detail");
  });

  // ── Start ───────────────────────────────────────────────────

  header.startPolling();
  switchScreen("dashboard");
  renderer.start();
}

// ── Run ───────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
