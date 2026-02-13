import { getCommandByTrigger } from "./slashCommands";

export interface ExpansionResult {
  newText: string;
  newCursorPosition: number;
}

/**
 * Scans backward from cursor to find a pending `/` command.
 * Returns the slash index and partial query, or null if no `/` is active.
 * Used by both expansion and autocomplete popup.
 */
export function detectPendingSlash(
  text: string,
  cursorPosition: number
): { slashIndex: number; query: string } | null {
  let slashIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n") break;
    if (ch === "/") {
      slashIndex = i;
      break;
    }
  }

  if (slashIndex === -1) return null;

  const query = text.substring(slashIndex + 1, cursorPosition);
  return { slashIndex, query };
}

/**
 * Attempts to expand a slash command at the current cursor position.
 * Scans backward from cursor to find a `/`, extracts the trigger word,
 * and if it matches a known command, returns the expanded text.
 *
 * Returns null if no command was found at the cursor position.
 */
export function tryExpandSlashCommand(
  text: string,
  cursorPosition: number
): ExpansionResult | null {
  const pending = detectPendingSlash(text, cursorPosition);
  if (!pending || !pending.query) return null;

  const command = getCommandByTrigger(pending.query);
  if (!command) return null;

  const before = text.substring(0, pending.slashIndex);
  const after = text.substring(cursorPosition);
  const newText = before + command.expansion + after;
  const endOfExpansion = before.length + command.expansion.length;
  const newCursorPosition = endOfExpansion - command.cursorOffset;

  return { newText, newCursorPosition };
}
