"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCommandsByCategory } from "@/lib/scratchpad/slashCommands";

const CATEGORY_LABELS: Record<string, string> = {
  formatting: "Formatting",
  operators: "Operators",
  greek: "Greek Letters",
  symbols: "Symbols",
  delimiters: "Delimiters",
};

export function ScratchpadToolbar() {
  const [showHelp, setShowHelp] = useState(false);
  const grouped = getCommandsByCategory();

  return (
    <div className="border-t bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          Type <kbd className="bg-muted px-1 rounded text-xs font-mono">/cmd</kbd> then{" "}
          <kbd className="bg-muted px-1 rounded text-xs font-mono">Space</kbd> to expand
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setShowHelp(!showHelp)}
        >
          {showHelp ? "Hide" : "Shortcuts"}
        </Button>
      </div>

      {showHelp && (
        <div className="border-t px-3 py-3 max-h-64 overflow-y-auto">
          {Object.entries(grouped).map(([category, commands]) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {commands.map((cmd) => (
                  <Badge
                    key={cmd.trigger}
                    variant="outline"
                    className="font-mono text-xs cursor-default"
                    title={`/${cmd.trigger} → ${cmd.expansion}`}
                  >
                    /{cmd.trigger}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t text-xs text-muted-foreground space-y-0.5">
            <p><kbd className="bg-muted px-1 rounded font-mono">Ctrl+S</kbd> Save</p>
            <p><kbd className="bg-muted px-1 rounded font-mono">$...$</kbd> Inline math</p>
            <p><kbd className="bg-muted px-1 rounded font-mono">$$...$$</kbd> Display math</p>
          </div>
        </div>
      )}
    </div>
  );
}
