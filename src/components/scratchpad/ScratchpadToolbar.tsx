"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCommandsByCategory } from "@/lib/scratchpad/slashCommands";
import { SymbolPicker } from "./SymbolPicker";

const CATEGORY_LABELS: Record<string, string> = {
  formatting: "Formatting",
  operators: "Operators",
  greek: "Greek Letters",
  symbols: "Symbols",
  delimiters: "Delimiters",
};

type PanelMode = "none" | "help" | "symbols";

interface ScratchpadToolbarProps {
  onInsertSymbol: (text: string, cursorOffset: number) => void;
}

export function ScratchpadToolbar({ onInsertSymbol }: ScratchpadToolbarProps) {
  const [panel, setPanel] = useState<PanelMode>("none");
  const grouped = getCommandsByCategory();

  const togglePanel = (mode: PanelMode) => {
    setPanel((prev) => (prev === mode ? "none" : mode));
  };

  return (
    <div className="border-t bg-muted/30">
      {/* Symbol Picker Panel */}
      {panel === "symbols" && (
        <SymbolPicker onInsert={onInsertSymbol} />
      )}

      {/* Help Panel */}
      {panel === "help" && (
        <div className="border-t px-3 py-3 max-h-72 overflow-y-auto text-xs space-y-4">
          {/* Quick Start */}
          <div>
            <p className="font-medium text-foreground mb-1.5">Quick Start</p>
            <div className="text-muted-foreground space-y-1">
              <p>Write notes using <strong>Markdown</strong> with LaTeX math support.</p>
              <p>
                <kbd className="bg-muted px-1 rounded font-mono">$x^2 + y^2$</kbd> for inline math:{" "}
                wrap LaTeX in single dollar signs.
              </p>
              <p>
                <kbd className="bg-muted px-1 rounded font-mono">$$\sum_&#123;i=1&#125;^n x_i$$</kbd> for display math:{" "}
                wrap in double dollar signs.
              </p>
              <p>
                Type <kbd className="bg-muted px-1 rounded font-mono">/command</kbd> then{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Space</kbd> or{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Tab</kbd> to expand LaTeX shortcuts.
                A popup will show matching commands as you type.
              </p>
              <p>Notes autosave after 30 seconds of inactivity, or press{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Ctrl+S</kbd> to save immediately.
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <p className="font-medium text-foreground mb-1.5">Keyboard Shortcuts</p>
            <div className="text-muted-foreground space-y-0.5">
              <p><kbd className="bg-muted px-1 rounded font-mono">Ctrl+S</kbd> Save now</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Tab</kbd> Expand command or insert indent</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Space</kbd> Expand command (after /cmd)</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Enter</kbd> Select from popup</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Esc</kbd> Close popup</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">&uarr; &darr;</kbd> Navigate popup</p>
            </div>
          </div>

          {/* Slash Commands */}
          <div>
            <p className="font-medium text-foreground mb-1.5">Slash Commands</p>
            {Object.entries(grouped).map(([category, commands]) => (
              <div key={category} className="mb-2 last:mb-0">
                <p className="text-muted-foreground/70 mb-1">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="flex flex-wrap gap-1">
                  {commands.map((cmd) => (
                    <Badge
                      key={cmd.trigger}
                      variant="outline"
                      className="font-mono text-[10px] cursor-default py-0"
                      title={`/${cmd.trigger} → ${cmd.expansion}`}
                    >
                      /{cmd.trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Button bar */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          Type <kbd className="bg-muted px-1 rounded text-xs font-mono">/</kbd> for commands
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant={panel === "symbols" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => togglePanel("symbols")}
          >
            Symbols
          </Button>
          <Button
            variant={panel === "help" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => togglePanel("help")}
          >
            Help
          </Button>
        </div>
      </div>
    </div>
  );
}
