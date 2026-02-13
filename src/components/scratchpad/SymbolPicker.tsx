"use client";

import { useState } from "react";
import { getCommandsByCategory } from "@/lib/scratchpad/slashCommands";
import type { SlashCommand } from "@/lib/scratchpad/slashCommands";

const CATEGORY_LABELS: Record<string, string> = {
  greek: "Greek",
  symbols: "Symbols",
  operators: "Operators",
  delimiters: "Delimiters",
  formatting: "Formatting",
};

const CATEGORY_ORDER = ["greek", "symbols", "operators", "delimiters", "formatting"];

interface SymbolPickerProps {
  onInsert: (text: string, cursorOffset: number) => void;
}

export function SymbolPicker({ onInsert }: SymbolPickerProps) {
  const [activeCategory, setActiveCategory] = useState("greek");
  const grouped = getCommandsByCategory();

  return (
    <div className="border-t bg-muted/20">
      {/* Category tabs */}
      <div className="flex border-b px-1 gap-0.5 overflow-x-auto">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`px-2 py-1 text-xs whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? "text-foreground border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Symbol grid */}
      <div className="p-2 max-h-36 overflow-y-auto">
        <div className="grid grid-cols-5 gap-1">
          {(grouped[activeCategory] ?? []).map((cmd: SlashCommand) => (
            <button
              key={cmd.trigger}
              type="button"
              className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-accent transition-colors text-center"
              title={`/${cmd.trigger} — ${cmd.description}\n${cmd.expansion}`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                onInsert(cmd.expansion, cmd.cursorOffset);
              }}
            >
              <span className="text-sm font-mono leading-none">
                {getDisplayGlyph(cmd)}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none truncate w-full">
                {cmd.trigger}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Get a display glyph for a command — unicode where possible, LaTeX command otherwise */
function getDisplayGlyph(cmd: SlashCommand): string {
  const glyphs: Record<string, string> = {
    alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", Gamma: "\u0393",
    delta: "\u03B4", Delta: "\u0394", epsilon: "\u03B5", zeta: "\u03B6",
    eta: "\u03B7", theta: "\u03B8", Theta: "\u0398", lambda: "\u03BB",
    Lambda: "\u039B", mu: "\u03BC", nu: "\u03BD", xi: "\u03BE",
    pi: "\u03C0", Pi: "\u03A0", rho: "\u03C1", sigma: "\u03C3",
    Sigma: "\u03A3", tau: "\u03C4", phi: "\u03C6", Phi: "\u03A6",
    psi: "\u03C8", Psi: "\u03A8", omega: "\u03C9", Omega: "\u03A9",
    inf: "\u221E", pm: "\u00B1", times: "\u00D7", cdot: "\u22C5",
    leq: "\u2264", geq: "\u2265", neq: "\u2260", approx: "\u2248",
    to: "\u2192", implies: "\u21D2", iff: "\u21D4", forall: "\u2200",
    exists: "\u2203", "in": "\u2208", subset: "\u2282", cup: "\u222A",
    cap: "\u2229", empty: "\u2205", dots: "\u2026",
    sum: "\u2211", int: "\u222B", iint: "\u222C", iiint: "\u222D",
    prod: "\u220F", nabla: "\u2207", partial: "\u2202",
    R: "\u211D", Z: "\u2124", N: "\u2115", C: "\u2102",
    frac: "a/b", sqrt: "\u221A", u: "x\u00B2", d: "x\u2082",
    lim: "lim", "lim-inf": "lim\u221E",
    "sum-1-inf": "\u2211\u221E", "sum-1-n": "\u2211n",
    paren: "()", brack: "[]", brace: "{}", abs: "||", norm: "\u2016\u2016",
    matrix: "[M]", math: "$$", imath: "$",
    text: "Aa", bold: "B", vec: "\u20D7", hat: "\u0302", bar: "\u0304",
    overline: "\u0305", nsqrt: "\u221An",
  };
  return glyphs[cmd.trigger] ?? cmd.trigger;
}
