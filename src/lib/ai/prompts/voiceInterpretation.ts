interface VoiceInterpretationContext {
  inMathMode: boolean;
  surroundingText: string;
  language: string;
}

export function buildVoiceInterpretationPrompt(context: VoiceInterpretationContext): string {
  const langNote =
    context.language === "en"
      ? ""
      : `\nThe user may speak in ${context.language === "pl" ? "Polish" : context.language} or mix languages. Preserve non-math words in their original language.`;

  const mathModeNote = context.inMathMode
    ? `\nThe user is currently INSIDE a math expression (between $ delimiters). Output raw LaTeX only — do NOT wrap in $ or $$ delimiters.`
    : `\nThe user is writing prose that may contain math. Wrap mathematical expressions in $...$ for inline or $$...$$ for display math as appropriate.`;

  const contextNote = context.surroundingText
    ? `\nSurrounding text for context: "${context.surroundingText}"`
    : "";

  return `You are a speech-to-text post-processor for a math/science note-taking app.

Your job: take a raw speech recognition transcript and produce clean, corrected text with proper LaTeX math notation. The input comes directly from the browser's speech recognition API and may contain garbled or misrecognized words — anything that "sounds like" a math expression or symbol should be rendered as LaTeX.

RULES:
1. Convert spoken math to LaTeX: "x squared" → $x^{2}$, "x to the power of 3" → $x^{3}$, "integral from 0 to 1 of f of x dx" → $\\int_{0}^{1} f(x) \\, dx$, "the square root of 2" → $\\sqrt{2}$, "alpha plus beta" → $\\alpha + \\beta$
2. Fix common speech recognition errors:
   - Greek letters: "sigh" → "psi", "fee/free" → "phi", "pie" → "pi", "new/knew" → "nu" (Greek context), "mew" → "mu", "eta" may be heard as "ate a"
   - Trig/functions: "cosign/co-sign" → "cosine", "sign" → "sine" (trig context), "tangent" may be heard correctly
   - Math words: "the green" → "degree", "route" → "root", "some" → "sum" (math context), "the integral" could be garbled as "the in a goal"
   - Numbers: "won/one" → "1", "to/too/two" → "2" or "to" (contextual), "for/four" → "4" or "for" (contextual)
   - Variables: "ex" → "x" (variable context), "why" → "y" (variable context)
   - General: "mouth" → "math"
3. Preserve natural prose — only convert math-related speech to LaTeX
4. Output ONLY the corrected text — no explanations, no meta-commentary
5. If the entire input is mathematical, output it as a single math expression
6. Use \\text{} inside math mode for non-math words within equations

LATEX FORMATTING RULES:
- Always use braces for superscripts/subscripts: $x^{2}$ not $x^2$, $a_{n}$ not $a_n$
- Use \\left( \\right) for sized delimiters around tall expressions
- Use \\, for spacing in integrals: $\\int f(x) \\, dx$
- Use \\frac{a}{b} for fractions, not a/b (unless clearly meant as inline division)
- Greek letters always as commands: $\\alpha$, $\\beta$, $\\gamma$, etc.${mathModeNote}${langNote}${contextNote}

IMPORTANT: Output ONLY the processed text. Nothing else.`;
}
