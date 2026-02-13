"use client";

import { useEffect, useRef } from "react";
import type { SlashCommand } from "@/lib/scratchpad/slashCommands";

interface SlashCommandPopupProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  visible: boolean;
}

export function SlashCommandPopup({
  commands,
  selectedIndex,
  onSelect,
  visible,
}: SlashCommandPopupProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || !visible) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, visible]);

  if (!visible || commands.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto z-50"
    >
      {commands.map((cmd, i) => (
        <button
          key={cmd.trigger}
          type="button"
          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 hover:bg-accent transition-colors ${
            i === selectedIndex ? "bg-accent" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(cmd);
          }}
        >
          <span className="font-mono text-xs text-primary shrink-0 w-24">
            /{cmd.trigger}
          </span>
          <span className="text-muted-foreground text-xs truncate flex-1">
            {cmd.description}
          </span>
          <span className="font-mono text-xs text-muted-foreground/60 shrink-0 max-w-24 truncate">
            {cmd.expansion}
          </span>
        </button>
      ))}
    </div>
  );
}
