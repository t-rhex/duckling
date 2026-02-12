/**
 * Footer status bar — shown at the bottom of every screen.
 */

import {
  BoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";
import { theme } from "../theme.js";
import { addAll } from "../util.js";

export function createFooter(renderer: CliRenderer): BoxRenderable {
  const footer = new BoxRenderable(renderer, {
    id: "footer",
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 1,
    backgroundColor: theme.bgDark,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingX: 2,
  });

  const hint = new TextRenderable(renderer, {
    id: "footer-hint",
    content: "Press [?] for help",
    fg: theme.fgDim,
  });

  const brand = new TextRenderable(renderer, {
    id: "footer-brand",
    content: "duckling // autonomous coding agent",
    fg: theme.fgMuted,
  });

  addAll(footer, hint, brand);
  return footer;
}
