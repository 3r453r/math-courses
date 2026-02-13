export interface SlashCommand {
  trigger: string;
  expansion: string;
  /** How many characters before the end of expansion to place the cursor */
  cursorOffset: number;
  description: string;
  category: "formatting" | "operators" | "greek" | "symbols" | "delimiters";
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Formatting
  { trigger: "u", expansion: "^{}", cursorOffset: 1, description: "Superscript", category: "formatting" },
  { trigger: "d", expansion: "_{}", cursorOffset: 1, description: "Subscript", category: "formatting" },
  { trigger: "frac", expansion: "\\frac{}{}", cursorOffset: 4, description: "Fraction", category: "formatting" },
  { trigger: "sqrt", expansion: "\\sqrt{}", cursorOffset: 1, description: "Square root", category: "formatting" },
  { trigger: "nsqrt", expansion: "\\sqrt[]{}", cursorOffset: 4, description: "Nth root", category: "formatting" },
  { trigger: "math", expansion: "$$\n\n$$", cursorOffset: 3, description: "Display math block", category: "formatting" },
  { trigger: "imath", expansion: "$$", cursorOffset: 1, description: "Inline math", category: "formatting" },
  { trigger: "text", expansion: "\\text{}", cursorOffset: 1, description: "Text in math", category: "formatting" },
  { trigger: "bold", expansion: "\\mathbf{}", cursorOffset: 1, description: "Bold math", category: "formatting" },
  { trigger: "vec", expansion: "\\vec{}", cursorOffset: 1, description: "Vector arrow", category: "formatting" },
  { trigger: "hat", expansion: "\\hat{}", cursorOffset: 1, description: "Hat accent", category: "formatting" },
  { trigger: "bar", expansion: "\\bar{}", cursorOffset: 1, description: "Bar accent", category: "formatting" },
  { trigger: "overline", expansion: "\\overline{}", cursorOffset: 1, description: "Overline", category: "formatting" },

  // Operators
  { trigger: "sum", expansion: "\\sum_{}^{}", cursorOffset: 4, description: "Summation", category: "operators" },
  { trigger: "sum-1-inf", expansion: "\\sum_{1}^{\\infty}", cursorOffset: 0, description: "Sum 1 to infinity", category: "operators" },
  { trigger: "sum-1-n", expansion: "\\sum_{i=1}^{n}", cursorOffset: 0, description: "Sum 1 to n", category: "operators" },
  { trigger: "int", expansion: "\\int_{}^{}", cursorOffset: 4, description: "Integral", category: "operators" },
  { trigger: "iint", expansion: "\\iint", cursorOffset: 0, description: "Double integral", category: "operators" },
  { trigger: "iiint", expansion: "\\iiint", cursorOffset: 0, description: "Triple integral", category: "operators" },
  { trigger: "prod", expansion: "\\prod_{}^{}", cursorOffset: 4, description: "Product", category: "operators" },
  { trigger: "lim", expansion: "\\lim_{}", cursorOffset: 1, description: "Limit", category: "operators" },
  { trigger: "lim-inf", expansion: "\\lim_{n \\to \\infty}", cursorOffset: 0, description: "Limit to infinity", category: "operators" },
  { trigger: "partial", expansion: "\\frac{\\partial }{\\partial }", cursorOffset: 12, description: "Partial derivative", category: "operators" },
  { trigger: "nabla", expansion: "\\nabla", cursorOffset: 0, description: "Nabla/gradient", category: "operators" },

  // Greek letters
  { trigger: "alpha", expansion: "\\alpha", cursorOffset: 0, description: "alpha", category: "greek" },
  { trigger: "beta", expansion: "\\beta", cursorOffset: 0, description: "beta", category: "greek" },
  { trigger: "gamma", expansion: "\\gamma", cursorOffset: 0, description: "gamma", category: "greek" },
  { trigger: "Gamma", expansion: "\\Gamma", cursorOffset: 0, description: "Gamma (upper)", category: "greek" },
  { trigger: "delta", expansion: "\\delta", cursorOffset: 0, description: "delta", category: "greek" },
  { trigger: "Delta", expansion: "\\Delta", cursorOffset: 0, description: "Delta (upper)", category: "greek" },
  { trigger: "epsilon", expansion: "\\epsilon", cursorOffset: 0, description: "epsilon", category: "greek" },
  { trigger: "zeta", expansion: "\\zeta", cursorOffset: 0, description: "zeta", category: "greek" },
  { trigger: "eta", expansion: "\\eta", cursorOffset: 0, description: "eta", category: "greek" },
  { trigger: "theta", expansion: "\\theta", cursorOffset: 0, description: "theta", category: "greek" },
  { trigger: "Theta", expansion: "\\Theta", cursorOffset: 0, description: "Theta (upper)", category: "greek" },
  { trigger: "lambda", expansion: "\\lambda", cursorOffset: 0, description: "lambda", category: "greek" },
  { trigger: "Lambda", expansion: "\\Lambda", cursorOffset: 0, description: "Lambda (upper)", category: "greek" },
  { trigger: "mu", expansion: "\\mu", cursorOffset: 0, description: "mu", category: "greek" },
  { trigger: "nu", expansion: "\\nu", cursorOffset: 0, description: "nu", category: "greek" },
  { trigger: "xi", expansion: "\\xi", cursorOffset: 0, description: "xi", category: "greek" },
  { trigger: "pi", expansion: "\\pi", cursorOffset: 0, description: "pi", category: "greek" },
  { trigger: "Pi", expansion: "\\Pi", cursorOffset: 0, description: "Pi (upper)", category: "greek" },
  { trigger: "rho", expansion: "\\rho", cursorOffset: 0, description: "rho", category: "greek" },
  { trigger: "sigma", expansion: "\\sigma", cursorOffset: 0, description: "sigma", category: "greek" },
  { trigger: "Sigma", expansion: "\\Sigma", cursorOffset: 0, description: "Sigma (upper)", category: "greek" },
  { trigger: "tau", expansion: "\\tau", cursorOffset: 0, description: "tau", category: "greek" },
  { trigger: "phi", expansion: "\\phi", cursorOffset: 0, description: "phi", category: "greek" },
  { trigger: "Phi", expansion: "\\Phi", cursorOffset: 0, description: "Phi (upper)", category: "greek" },
  { trigger: "psi", expansion: "\\psi", cursorOffset: 0, description: "psi", category: "greek" },
  { trigger: "Psi", expansion: "\\Psi", cursorOffset: 0, description: "Psi (upper)", category: "greek" },
  { trigger: "omega", expansion: "\\omega", cursorOffset: 0, description: "omega", category: "greek" },
  { trigger: "Omega", expansion: "\\Omega", cursorOffset: 0, description: "Omega (upper)", category: "greek" },

  // Symbols
  { trigger: "inf", expansion: "\\infty", cursorOffset: 0, description: "Infinity", category: "symbols" },
  { trigger: "pm", expansion: "\\pm", cursorOffset: 0, description: "Plus-minus", category: "symbols" },
  { trigger: "times", expansion: "\\times", cursorOffset: 0, description: "Times", category: "symbols" },
  { trigger: "cdot", expansion: "\\cdot", cursorOffset: 0, description: "Center dot", category: "symbols" },
  { trigger: "leq", expansion: "\\leq", cursorOffset: 0, description: "Less or equal", category: "symbols" },
  { trigger: "geq", expansion: "\\geq", cursorOffset: 0, description: "Greater or equal", category: "symbols" },
  { trigger: "neq", expansion: "\\neq", cursorOffset: 0, description: "Not equal", category: "symbols" },
  { trigger: "approx", expansion: "\\approx", cursorOffset: 0, description: "Approximately", category: "symbols" },
  { trigger: "to", expansion: "\\to", cursorOffset: 0, description: "Right arrow", category: "symbols" },
  { trigger: "implies", expansion: "\\implies", cursorOffset: 0, description: "Implies", category: "symbols" },
  { trigger: "iff", expansion: "\\iff", cursorOffset: 0, description: "If and only if", category: "symbols" },
  { trigger: "forall", expansion: "\\forall", cursorOffset: 0, description: "For all", category: "symbols" },
  { trigger: "exists", expansion: "\\exists", cursorOffset: 0, description: "Exists", category: "symbols" },
  { trigger: "in", expansion: "\\in", cursorOffset: 0, description: "Element of", category: "symbols" },
  { trigger: "subset", expansion: "\\subset", cursorOffset: 0, description: "Subset", category: "symbols" },
  { trigger: "cup", expansion: "\\cup", cursorOffset: 0, description: "Union", category: "symbols" },
  { trigger: "cap", expansion: "\\cap", cursorOffset: 0, description: "Intersection", category: "symbols" },
  { trigger: "empty", expansion: "\\emptyset", cursorOffset: 0, description: "Empty set", category: "symbols" },
  { trigger: "R", expansion: "\\mathbb{R}", cursorOffset: 0, description: "Real numbers", category: "symbols" },
  { trigger: "Z", expansion: "\\mathbb{Z}", cursorOffset: 0, description: "Integers", category: "symbols" },
  { trigger: "N", expansion: "\\mathbb{N}", cursorOffset: 0, description: "Natural numbers", category: "symbols" },
  { trigger: "C", expansion: "\\mathbb{C}", cursorOffset: 0, description: "Complex numbers", category: "symbols" },
  { trigger: "dots", expansion: "\\dots", cursorOffset: 0, description: "Dots", category: "symbols" },

  // Delimiters
  { trigger: "paren", expansion: "\\left(  \\right)", cursorOffset: 8, description: "Parentheses", category: "delimiters" },
  { trigger: "brack", expansion: "\\left[  \\right]", cursorOffset: 8, description: "Brackets", category: "delimiters" },
  { trigger: "brace", expansion: "\\left\\{  \\right\\}", cursorOffset: 10, description: "Braces", category: "delimiters" },
  { trigger: "abs", expansion: "\\left|  \\right|", cursorOffset: 8, description: "Absolute value", category: "delimiters" },
  { trigger: "norm", expansion: "\\left\\|  \\right\\|", cursorOffset: 10, description: "Norm", category: "delimiters" },
  { trigger: "matrix", expansion: "\\begin{pmatrix}\n  \n\\end{pmatrix}", cursorOffset: 16, description: "Matrix", category: "delimiters" },
];

/** Build a lookup map for O(1) trigger matching */
const commandMap = new Map<string, SlashCommand>();
for (const cmd of SLASH_COMMANDS) {
  commandMap.set(cmd.trigger, cmd);
}

export function getCommandByTrigger(trigger: string): SlashCommand | undefined {
  return commandMap.get(trigger);
}

/** Get all commands grouped by category */
export function getCommandsByCategory(): Record<string, SlashCommand[]> {
  const groups: Record<string, SlashCommand[]> = {};
  for (const cmd of SLASH_COMMANDS) {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  }
  return groups;
}

/** Filter commands by prefix match on trigger. Empty query returns a diverse sample. */
export function filterCommandsByPrefix(query: string, limit = 8): SlashCommand[] {
  if (!query) {
    // Return a sample from each category so the popup is representative
    const grouped = getCommandsByCategory();
    const results: SlashCommand[] = [];
    const perCategory = Math.max(1, Math.floor(limit / Object.keys(grouped).length));
    for (const cmds of Object.values(grouped)) {
      results.push(...cmds.slice(0, perCategory));
    }
    return results.slice(0, limit);
  }
  const lower = query.toLowerCase();
  const results: SlashCommand[] = [];
  for (const cmd of SLASH_COMMANDS) {
    if (cmd.trigger.toLowerCase().startsWith(lower)) {
      results.push(cmd);
      if (results.length >= limit) break;
    }
  }
  return results;
}
