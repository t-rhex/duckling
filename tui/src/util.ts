/**
 * Utility helpers for the Duckling TUI.
 */

import type { BoxRenderable, Renderable } from "@opentui/core";

/**
 * Add multiple children to a BoxRenderable.
 * OpenTUI's .add() only takes one child at a time.
 */
export function addAll(parent: BoxRenderable, ...children: Renderable[]) {
  for (const child of children) {
    parent.add(child);
  }
}

/**
 * Remove all children from a BoxRenderable.
 */
export function removeAllChildren(box: BoxRenderable) {
  const children = box.getChildren();
  for (const child of children) {
    box.remove(child.id);
  }
}
