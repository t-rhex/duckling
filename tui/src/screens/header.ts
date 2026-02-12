/**
 * Header bar — shown at the top of every screen.
 *
 * Layout:  [ DUCKLING ]  status indicator  |  navigation hints
 */

import {
  BoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";
import { theme } from "../theme.js";
import { addAll } from "../util.js";
import type { DucklingAPI } from "../api.js";

export class Header {
  private renderer: CliRenderer;
  private api: DucklingAPI;
  container: BoxRenderable;
  private statusText: TextRenderable;
  private poolText: TextRenderable;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(renderer: CliRenderer, api: DucklingAPI) {
    this.renderer = renderer;
    this.api = api;

    // Main container
    this.container = new BoxRenderable(renderer, {
      id: "header",
      width: "100%",
      height: 3,
      flexDirection: "column",
      backgroundColor: theme.bgDark,
    });

    // Top row
    const topRow = new BoxRenderable(renderer, {
      id: "header-top",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingX: 2,
      height: 1,
      width: "100%",
    });

    const leftGroup = new BoxRenderable(renderer, {
      id: "header-left",
      flexDirection: "row",
      gap: 2,
    });

    const logo = new TextRenderable(renderer, {
      id: "header-logo",
      content: "DUCKLING",
      fg: theme.cyan,
    });

    this.statusText = new TextRenderable(renderer, {
      id: "header-status",
      content: "connecting...",
      fg: theme.fgDim,
    });

    this.poolText = new TextRenderable(renderer, {
      id: "header-pool",
      content: "",
      fg: theme.fgDim,
    });

    addAll(leftGroup, logo, this.statusText, this.poolText);
    topRow.add(leftGroup);

    const versionText = new TextRenderable(renderer, {
      id: "header-version",
      content: "v0.1.0",
      fg: theme.fgDim,
    });
    topRow.add(versionText);

    // Nav row
    const navRow = new BoxRenderable(renderer, {
      id: "header-nav",
      flexDirection: "row",
      paddingX: 2,
      height: 1,
      width: "100%",
    });

    const navText = new TextRenderable(renderer, {
      id: "header-nav-text",
      content: "[1] Dashboard  [2] New Task  [3] Tasks  [q] Quit",
      fg: theme.fgDim,
    });
    navRow.add(navText);

    // Separator
    const sep = new BoxRenderable(renderer, {
      id: "header-sep",
      width: "100%",
      height: 1,
      backgroundColor: theme.borderDim,
    });

    addAll(this.container, topRow, navRow, sep);
  }

  startPolling() {
    this.refresh();
    this.pollingTimer = setInterval(() => this.refresh(), 5000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async refresh() {
    try {
      const health = await this.api.getHealth();
      this.statusText.content = "ONLINE";
      this.statusText.fg = theme.green;
      if (health.pool) {
        const p = health.pool;
        this.poolText.content = `| ${p.ready_vms} warm  ${p.claimed_vms} busy  ${p.total_vms} total`;
        this.poolText.fg = theme.fgDim;
      }
    } catch {
      this.statusText.content = "OFFLINE";
      this.statusText.fg = theme.red;
      this.poolText.content = "";
    }
  }
}
