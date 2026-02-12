/**
 * New Task screen — submit a coding task to Duckling.
 *
 * Fields:
 *   - Description (input)
 *   - Repo URL (input)
 *   - Branch (input, default "main")
 *   - Mode (select: auto / review / code / peer_review)
 */

import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderable,
  SelectRenderableEvents,
  type CliRenderer,
} from "@opentui/core";
import { theme } from "../theme.js";
import { addAll } from "../util.js";
import type { DucklingAPI, TaskResponse } from "../api.js";

export type NewTaskCallback = (task: TaskResponse) => void;

export class NewTaskScreen {
  private renderer: CliRenderer;
  private api: DucklingAPI;
  container: BoxRenderable;
  private onSubmitCb: NewTaskCallback | null = null;

  // Form inputs
  private descInput: InputRenderable;
  private repoInput: InputRenderable;
  private branchInput: InputRenderable;
  private modeSelect: SelectRenderable;
  private statusText: TextRenderable;

  // Form state
  private descValue = "";
  private repoValue = "";
  private branchValue = "main";
  private selectedModeIndex = 0;

  // Focus management
  private focusableElements: Array<InputRenderable | SelectRenderable>;
  private focusIndex = 0;

  constructor(renderer: CliRenderer, api: DucklingAPI) {
    this.renderer = renderer;
    this.api = api;

    this.container = new BoxRenderable(renderer, {
      id: "new-task",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      paddingX: 2,
      paddingTop: 1,
      paddingBottom: 0,
      gap: 1,
    });

    // Title
    const title = new TextRenderable(renderer, {
      id: "newtask-title",
      content: "Submit New Task",
      fg: theme.fg,
    });

    const subtitle = new TextRenderable(renderer, {
      id: "newtask-subtitle",
      content: "Tab: next field  |  Ctrl+S: submit  |  Esc: cancel",
      fg: theme.fgDim,
    });

    this.statusText = new TextRenderable(renderer, {
      id: "newtask-status",
      content: "",
      fg: theme.fgDim,
    });

    // Form container
    const form = new BoxRenderable(renderer, {
      id: "newtask-form",
      flexDirection: "column",
      gap: 1,
      width: "100%",
      borderStyle: "rounded",
      borderColor: theme.border,
      title: " Task Details ",
      titleAlignment: "left",
      padding: 1,
    });

    // Description field
    const descRow = new BoxRenderable(renderer, {
      id: "newtask-desc-row",
      flexDirection: "row",
      gap: 1,
    });
    descRow.add(
      new TextRenderable(renderer, {
        id: "newtask-desc-label",
        content: "Description: ",
        fg: theme.fgDim,
      }),
    );
    this.descInput = new InputRenderable(renderer, {
      id: "newtask-desc-input",
      placeholder: "Describe what you want the agent to do...",
      width: 65,
      backgroundColor: theme.bgHighlight,
      focusedBackgroundColor: theme.bgLight,
      textColor: theme.fg,
      cursorColor: theme.accent,
    });
    this.descInput.on(InputRenderableEvents.INPUT, (val: string) => {
      this.descValue = val;
    });
    descRow.add(this.descInput);

    // Repo URL field
    const repoRow = new BoxRenderable(renderer, {
      id: "newtask-repo-row",
      flexDirection: "row",
      gap: 1,
    });
    repoRow.add(
      new TextRenderable(renderer, {
        id: "newtask-repo-label",
        content: "Repo URL:    ",
        fg: theme.fgDim,
      }),
    );
    this.repoInput = new InputRenderable(renderer, {
      id: "newtask-repo-input",
      placeholder: "https://github.com/owner/repo",
      width: 65,
      backgroundColor: theme.bgHighlight,
      focusedBackgroundColor: theme.bgLight,
      textColor: theme.fg,
      cursorColor: theme.accent,
    });
    this.repoInput.on(InputRenderableEvents.INPUT, (val: string) => {
      this.repoValue = val;
    });
    repoRow.add(this.repoInput);

    // Branch field
    const branchRow = new BoxRenderable(renderer, {
      id: "newtask-branch-row",
      flexDirection: "row",
      gap: 1,
    });
    branchRow.add(
      new TextRenderable(renderer, {
        id: "newtask-branch-label",
        content: "Branch:      ",
        fg: theme.fgDim,
      }),
    );
    this.branchInput = new InputRenderable(renderer, {
      id: "newtask-branch-input",
      placeholder: "main",
      width: 30,
      value: "main",
      backgroundColor: theme.bgHighlight,
      focusedBackgroundColor: theme.bgLight,
      textColor: theme.fg,
      cursorColor: theme.accent,
    });
    this.branchInput.on(InputRenderableEvents.INPUT, (val: string) => {
      this.branchValue = val;
    });
    branchRow.add(this.branchInput);

    // Mode select
    const modeRow = new BoxRenderable(renderer, {
      id: "newtask-mode-row",
      flexDirection: "row",
      gap: 1,
    });
    modeRow.add(
      new TextRenderable(renderer, {
        id: "newtask-mode-label",
        content: "Mode:        ",
        fg: theme.fgDim,
      }),
    );
    this.modeSelect = new SelectRenderable(renderer, {
      id: "newtask-mode-select",
      width: 40,
      height: 6,
      options: [
        { name: "Auto-detect", description: "Infer mode from description" },
        { name: "Review", description: "Analyze code quality, no changes" },
        { name: "Code", description: "Write code, create PR" },
        { name: "Peer Review", description: "Review a specific branch diff" },
      ],
      backgroundColor: theme.bgHighlight,
      focusedBackgroundColor: theme.bgLight,
      selectedBackgroundColor: theme.accent,
      selectedTextColor: theme.bgDark,
      textColor: theme.fg,
    });
    this.modeSelect.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (index: number) => {
        this.selectedModeIndex = index;
      },
    );
    modeRow.add(this.modeSelect);

    addAll(form, descRow, repoRow, branchRow, modeRow);

    // Help text
    const help = new TextRenderable(renderer, {
      id: "newtask-help",
      content: "Tab: next field  |  Ctrl+S: submit  |  Esc: cancel",
      fg: theme.fgMuted,
    });

    addAll(this.container, title, subtitle, this.statusText, form, help);

    // Focus management
    this.focusableElements = [
      this.descInput,
      this.repoInput,
      this.branchInput,
      this.modeSelect,
    ];
  }

  focus() {
    this.focusIndex = 0;
    this.descInput.focus();
  }

  focusNext() {
    this.focusIndex = (this.focusIndex + 1) % this.focusableElements.length;
    this.focusableElements[this.focusIndex].focus();
  }

  focusPrev() {
    this.focusIndex =
      (this.focusIndex - 1 + this.focusableElements.length) %
      this.focusableElements.length;
    this.focusableElements[this.focusIndex].focus();
  }

  setOnSubmit(cb: NewTaskCallback) {
    this.onSubmitCb = cb;
  }

  async submit() {
    const desc = this.descValue.trim();
    const repo = this.repoValue.trim();
    const branch = this.branchValue.trim() || "main";

    if (!desc || desc.length < 10) {
      this.statusText.content = "Description must be at least 10 characters.";
      this.statusText.fg = theme.error;
      return;
    }
    if (!repo) {
      this.statusText.content = "Repo URL is required.";
      this.statusText.fg = theme.error;
      return;
    }

    this.statusText.content = "Submitting task...";
    this.statusText.fg = theme.info;

    try {
      const modeMap = [undefined, "review", "code", "peer_review"] as const;
      const mode = modeMap[this.selectedModeIndex];

      const task = await this.api.createTask({
        description: desc,
        repo_url: repo,
        branch,
        mode: mode as any,
      });

      const reason = task.intent_reason ? ` (${task.intent_reason})` : "";
      this.statusText.content = `Task ${task.id.slice(0, 8)} created [${task.mode}]${reason}`;
      this.statusText.fg = theme.success;

      this.onSubmitCb?.(task);
    } catch (err: any) {
      this.statusText.content = `Failed: ${err.message || "Unknown error"}`;
      this.statusText.fg = theme.error;
    }
  }
}
