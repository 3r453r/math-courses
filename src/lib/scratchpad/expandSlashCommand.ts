import { getCommandByTrigger } from "./slashCommands";

export interface ExpansionResult {
  newText: string;
  newCursorPosition: number;
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
  // Scan backward from cursor to find the slash
  let slashIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const ch = text[i];
    // Stop at whitespace or newline — no command spans whitespace
    if (ch === " " || ch === "\t" || ch === "\n") break;
    if (ch === "/") {
      // Only match if slash is at start of text or preceded by whitespace/newline
      if (i === 0 || /\s/.test(text[i - 1])) {
        slashIndex = i;
      }
      break;
    }
  }

  if (slashIndex === -1) return null;

  const trigger = text.substring(slashIndex + 1, cursorPosition);
  if (!trigger) return null;

  const command = getCommandByTrigger(trigger);
  if (!command) return null;

  const before = text.substring(0, slashIndex);
  const after = text.substring(cursorPosition);
  const newText = before + command.expansion + after;
  const endOfExpansion = before.length + command.expansion.length;
  const newCursorPosition = endOfExpansion - command.cursorOffset;

  return { newText, newCursorPosition };
}
