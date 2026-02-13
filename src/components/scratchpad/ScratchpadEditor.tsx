"use client";

import { useRef, useCallback } from "react";
import { tryExpandSlashCommand } from "@/lib/scratchpad/expandSlashCommand";

interface ScratchpadEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  className?: string;
}

export function ScratchpadEditor({
  value,
  onChange,
  onSave,
  className,
}: ScratchpadEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+S / Cmd+S: manual save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      // Space or Tab: attempt slash-command expansion
      if (e.key === " " || e.key === "Tab") {
        const textarea = e.currentTarget;
        const result = tryExpandSlashCommand(
          textarea.value,
          textarea.selectionStart
        );

        if (result) {
          e.preventDefault();
          onChange(result.newText);
          // Place cursor after React re-render
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(
                result.newCursorPosition,
                result.newCursorPosition
              );
              textareaRef.current.focus();
            }
          });
        }
        // If no expansion, let Space/Tab proceed normally
      }
    },
    [onChange, onSave]
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className={`w-full h-full resize-none bg-background text-foreground font-mono text-sm p-4 outline-none placeholder:text-muted-foreground ${className ?? ""}`}
      placeholder="Start typing your notes here...&#10;&#10;Use LaTeX: $x^2$ for inline math, $$\sum_{i=1}^n$$ for display math&#10;&#10;Slash commands: /sum, /frac, /alpha, /int (press Space to expand)&#10;Press Ctrl+S to save"
      spellCheck={false}
    />
  );
}
