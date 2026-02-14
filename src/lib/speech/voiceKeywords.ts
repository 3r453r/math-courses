// Sentinel markers to protect multi-input output from simple keyword processing
const PROCESSED_START = "\uE000";
const PROCESSED_END = "\uE001";

export interface VoiceKeyword {
  phrase: string;
  replacement: string;
  category: "latex" | "structure" | "formatting" | "greek" | "operator";
}

export interface MultiInputVoiceKeyword {
  phrase: string;
  template: string; // uses $1, $2 for input slots
  inputs: number;
  category: string;
}

export interface ControlKeywords {
  nextInput: string;
  endInput: string;
}

export interface CustomKeyword {
  phrase: string;
  replacement: string;
}

const EN_KEYWORDS: VoiceKeyword[] = [
  // Structure (LaTeX delimiters)
  { phrase: "display mathematics open", replacement: "$$\n", category: "structure" },
  { phrase: "display mathematics close", replacement: "\n$$", category: "structure" },
  { phrase: "mathematics open", replacement: "$", category: "structure" },
  { phrase: "mathematics close", replacement: "$", category: "structure" },
  { phrase: "open brace", replacement: "{", category: "structure" },
  { phrase: "close brace", replacement: "}", category: "structure" },

  // Math operators
  { phrase: "superscript", replacement: "^{}", category: "operator" },
  { phrase: "subscript", replacement: "_{}", category: "operator" },
  { phrase: "fraction", replacement: "\\frac{}{}", category: "operator" },
  { phrase: "square root", replacement: "\\sqrt{}", category: "operator" },
  { phrase: "nth root", replacement: "\\sqrt[]{}", category: "operator" },
  { phrase: "integral", replacement: "\\int", category: "operator" },
  { phrase: "double integral", replacement: "\\iint", category: "operator" },
  { phrase: "triple integral", replacement: "\\iiint", category: "operator" },
  { phrase: "sum", replacement: "\\sum", category: "operator" },
  { phrase: "infinity", replacement: "\\infty", category: "operator" },
  { phrase: "plus minus", replacement: "\\pm", category: "operator" },
  { phrase: "times", replacement: "\\times", category: "operator" },
  { phrase: "center dot", replacement: "\\cdot", category: "operator" },
  { phrase: "not equal", replacement: "\\neq", category: "operator" },
  { phrase: "less than or equal", replacement: "\\leq", category: "operator" },
  { phrase: "greater than or equal", replacement: "\\geq", category: "operator" },
  { phrase: "approximately", replacement: "\\approx", category: "operator" },
  { phrase: "nabla", replacement: "\\nabla", category: "operator" },
  { phrase: "partial derivative", replacement: "\\frac{\\partial }{\\partial }", category: "operator" },
  { phrase: "limit to infinity", replacement: "\\lim_{n \\to \\infty}", category: "operator" },

  // Arrows and logic
  { phrase: "right arrow", replacement: "\\to", category: "operator" },
  { phrase: "implies", replacement: "\\implies", category: "operator" },
  { phrase: "if and only if", replacement: "\\iff", category: "operator" },
  { phrase: "for all", replacement: "\\forall", category: "operator" },
  { phrase: "there exists", replacement: "\\exists", category: "operator" },
  { phrase: "element of", replacement: "\\in", category: "operator" },

  // Sets
  { phrase: "subset", replacement: "\\subset", category: "operator" },
  { phrase: "union", replacement: "\\cup", category: "operator" },
  { phrase: "intersection", replacement: "\\cap", category: "operator" },
  { phrase: "empty set", replacement: "\\emptyset", category: "operator" },
  { phrase: "real numbers", replacement: "\\mathbb{R}", category: "operator" },
  { phrase: "integers", replacement: "\\mathbb{Z}", category: "operator" },
  { phrase: "natural numbers", replacement: "\\mathbb{N}", category: "operator" },
  { phrase: "complex numbers", replacement: "\\mathbb{C}", category: "operator" },
  { phrase: "dots", replacement: "\\dots", category: "operator" },

  // Formatting / accents
  { phrase: "vector", replacement: "\\vec{}", category: "formatting" },
  { phrase: "hat accent", replacement: "\\hat{}", category: "formatting" },
  { phrase: "bar accent", replacement: "\\bar{}", category: "formatting" },
  { phrase: "overline", replacement: "\\overline{}", category: "formatting" },
  { phrase: "text mode", replacement: "\\text{}", category: "formatting" },
  { phrase: "math bold", replacement: "\\mathbf{}", category: "formatting" },

  // Delimiters (auto-sizing)
  { phrase: "parentheses", replacement: "\\left( \\right)", category: "structure" },
  { phrase: "brackets", replacement: "\\left[ \\right]", category: "structure" },
  { phrase: "absolute value", replacement: "\\left| \\right|", category: "structure" },
  { phrase: "norm", replacement: "\\left\\| \\right\\|", category: "structure" },

  // Greek letters
  { phrase: "alpha", replacement: "\\alpha", category: "greek" },
  { phrase: "beta", replacement: "\\beta", category: "greek" },
  { phrase: "gamma", replacement: "\\gamma", category: "greek" },
  { phrase: "delta", replacement: "\\delta", category: "greek" },
  { phrase: "epsilon", replacement: "\\epsilon", category: "greek" },
  { phrase: "zeta", replacement: "\\zeta", category: "greek" },
  { phrase: "eta", replacement: "\\eta", category: "greek" },
  { phrase: "theta", replacement: "\\theta", category: "greek" },
  { phrase: "lambda", replacement: "\\lambda", category: "greek" },
  { phrase: "mu", replacement: "\\mu", category: "greek" },
  { phrase: "nu", replacement: "\\nu", category: "greek" },
  { phrase: "xi", replacement: "\\xi", category: "greek" },
  { phrase: "pi", replacement: "\\pi", category: "greek" },
  { phrase: "rho", replacement: "\\rho", category: "greek" },
  { phrase: "sigma", replacement: "\\sigma", category: "greek" },
  { phrase: "tau", replacement: "\\tau", category: "greek" },
  { phrase: "phi", replacement: "\\phi", category: "greek" },
  { phrase: "psi", replacement: "\\psi", category: "greek" },
  { phrase: "omega", replacement: "\\omega", category: "greek" },
  // Uppercase Greek
  { phrase: "capital gamma", replacement: "\\Gamma", category: "greek" },
  { phrase: "capital delta", replacement: "\\Delta", category: "greek" },
  { phrase: "capital theta", replacement: "\\Theta", category: "greek" },
  { phrase: "capital lambda", replacement: "\\Lambda", category: "greek" },
  { phrase: "capital pi", replacement: "\\Pi", category: "greek" },
  { phrase: "capital sigma", replacement: "\\Sigma", category: "greek" },
  { phrase: "capital phi", replacement: "\\Phi", category: "greek" },
  { phrase: "capital psi", replacement: "\\Psi", category: "greek" },
  { phrase: "capital omega", replacement: "\\Omega", category: "greek" },

  // Text formatting
  { phrase: "new paragraph", replacement: "\n\n", category: "formatting" },
  { phrase: "new line", replacement: "\n", category: "formatting" },
  { phrase: "bold", replacement: "**", category: "formatting" },
  { phrase: "italic", replacement: "*", category: "formatting" },
];

const PL_KEYWORDS: VoiceKeyword[] = [
  // Structure
  { phrase: "wzór otwórz", replacement: "$$\n", category: "structure" },
  { phrase: "wzór zamknij", replacement: "\n$$", category: "structure" },
  { phrase: "matematyka otwórz", replacement: "$", category: "structure" },
  { phrase: "matematyka zamknij", replacement: "$", category: "structure" },
  { phrase: "nawias klamrowy otwórz", replacement: "{", category: "structure" },
  { phrase: "nawias klamrowy zamknij", replacement: "}", category: "structure" },

  // Math operators
  { phrase: "indeks górny", replacement: "^{}", category: "operator" },
  { phrase: "indeks dolny", replacement: "_{}", category: "operator" },
  { phrase: "ułamek", replacement: "\\frac{}{}", category: "operator" },
  { phrase: "pierwiastek", replacement: "\\sqrt{}", category: "operator" },
  { phrase: "całka", replacement: "\\int", category: "operator" },
  { phrase: "podwójna całka", replacement: "\\iint", category: "operator" },
  { phrase: "potrójna całka", replacement: "\\iiint", category: "operator" },
  { phrase: "suma", replacement: "\\sum", category: "operator" },
  { phrase: "nieskończoność", replacement: "\\infty", category: "operator" },
  { phrase: "plus minus", replacement: "\\pm", category: "operator" },
  { phrase: "razy", replacement: "\\times", category: "operator" },
  { phrase: "iloczyn skalarny", replacement: "\\cdot", category: "operator" },
  { phrase: "nierówne", replacement: "\\neq", category: "operator" },
  { phrase: "mniejsze lub równe", replacement: "\\leq", category: "operator" },
  { phrase: "większe lub równe", replacement: "\\geq", category: "operator" },
  { phrase: "w przybliżeniu", replacement: "\\approx", category: "operator" },
  { phrase: "nabla", replacement: "\\nabla", category: "operator" },
  { phrase: "granica do nieskończoności", replacement: "\\lim_{n \\to \\infty}", category: "operator" },

  // Arrows and logic
  { phrase: "strzałka w prawo", replacement: "\\to", category: "operator" },
  { phrase: "wynika", replacement: "\\implies", category: "operator" },
  { phrase: "wtedy i tylko wtedy", replacement: "\\iff", category: "operator" },
  { phrase: "dla każdego", replacement: "\\forall", category: "operator" },
  { phrase: "istnieje", replacement: "\\exists", category: "operator" },
  { phrase: "element zbioru", replacement: "\\in", category: "operator" },

  // Sets
  { phrase: "podzbiór", replacement: "\\subset", category: "operator" },
  { phrase: "suma zbiorów", replacement: "\\cup", category: "operator" },
  { phrase: "część wspólna", replacement: "\\cap", category: "operator" },
  { phrase: "zbiór pusty", replacement: "\\emptyset", category: "operator" },
  { phrase: "liczby rzeczywiste", replacement: "\\mathbb{R}", category: "operator" },
  { phrase: "liczby całkowite", replacement: "\\mathbb{Z}", category: "operator" },
  { phrase: "liczby naturalne", replacement: "\\mathbb{N}", category: "operator" },
  { phrase: "liczby zespolone", replacement: "\\mathbb{C}", category: "operator" },
  { phrase: "kropki", replacement: "\\dots", category: "operator" },

  // Formatting / accents
  { phrase: "wektor", replacement: "\\vec{}", category: "formatting" },
  { phrase: "daszek", replacement: "\\hat{}", category: "formatting" },
  { phrase: "nadkreślenie", replacement: "\\overline{}", category: "formatting" },
  { phrase: "tryb tekstowy", replacement: "\\text{}", category: "formatting" },
  { phrase: "pogrubienie matematyczne", replacement: "\\mathbf{}", category: "formatting" },

  // Delimiters
  { phrase: "nawiasy okrągłe", replacement: "\\left( \\right)", category: "structure" },
  { phrase: "nawiasy kwadratowe", replacement: "\\left[ \\right]", category: "structure" },
  { phrase: "wartość bezwzględna", replacement: "\\left| \\right|", category: "structure" },

  // Greek letters
  { phrase: "alfa", replacement: "\\alpha", category: "greek" },
  { phrase: "beta", replacement: "\\beta", category: "greek" },
  { phrase: "gamma", replacement: "\\gamma", category: "greek" },
  { phrase: "delta", replacement: "\\delta", category: "greek" },
  { phrase: "epsilon", replacement: "\\epsilon", category: "greek" },
  { phrase: "dzeta", replacement: "\\zeta", category: "greek" },
  { phrase: "eta", replacement: "\\eta", category: "greek" },
  { phrase: "theta", replacement: "\\theta", category: "greek" },
  { phrase: "lambda", replacement: "\\lambda", category: "greek" },
  { phrase: "mi", replacement: "\\mu", category: "greek" },
  { phrase: "ni", replacement: "\\nu", category: "greek" },
  { phrase: "ksi", replacement: "\\xi", category: "greek" },
  { phrase: "pi", replacement: "\\pi", category: "greek" },
  { phrase: "ro", replacement: "\\rho", category: "greek" },
  { phrase: "sigma", replacement: "\\sigma", category: "greek" },
  { phrase: "tau", replacement: "\\tau", category: "greek" },
  { phrase: "fi", replacement: "\\phi", category: "greek" },
  { phrase: "psi", replacement: "\\psi", category: "greek" },
  { phrase: "omega", replacement: "\\omega", category: "greek" },

  // Text formatting
  { phrase: "nowy akapit", replacement: "\n\n", category: "formatting" },
  { phrase: "nowa linia", replacement: "\n", category: "formatting" },
  { phrase: "pogrubienie", replacement: "**", category: "formatting" },
  { phrase: "kursywa", replacement: "*", category: "formatting" },
];

// --- Multi-input keywords ---

const EN_MULTI_INPUT: MultiInputVoiceKeyword[] = [
  { phrase: "summation", template: "\\sum_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "product over", template: "\\prod_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "integral from", template: "\\int_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "limit of", template: "\\lim_{$1}", inputs: 1, category: "operator" },
  { phrase: "fraction of", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
];

const PL_MULTI_INPUT: MultiInputVoiceKeyword[] = [
  { phrase: "sumowanie", template: "\\sum_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "iloczyn", template: "\\prod_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "całka od", template: "\\int_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "granica", template: "\\lim_{$1}", inputs: 1, category: "operator" },
  { phrase: "ułamek z", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
];

const CONTROL_KEYWORDS: Record<string, ControlKeywords> = {
  en: { nextInput: "next input", endInput: "end input" },
  pl: { nextInput: "następne pole", endInput: "koniec pola" },
};

// --- Lookup helpers ---

const KEYWORD_MAPS: Record<string, VoiceKeyword[]> = {
  en: EN_KEYWORDS,
  pl: PL_KEYWORDS,
};

const MULTI_INPUT_MAPS: Record<string, MultiInputVoiceKeyword[]> = {
  en: EN_MULTI_INPUT,
  pl: PL_MULTI_INPUT,
};

function getKeywords(lang: string): VoiceKeyword[] {
  return KEYWORD_MAPS[lang] ?? KEYWORD_MAPS["en"] ?? [];
}

function getMultiInputKeywords(lang: string): MultiInputVoiceKeyword[] {
  return MULTI_INPUT_MAPS[lang] ?? MULTI_INPUT_MAPS["en"] ?? [];
}

function getControlKeywords(lang: string): ControlKeywords {
  return CONTROL_KEYWORDS[lang] ?? CONTROL_KEYWORDS["en"]!;
}

// --- Public getters for config UI ---

export function getDefaultSimpleKeywords(lang: string): VoiceKeyword[] {
  return getKeywords(lang);
}

export function getDefaultMultiInputKeywords(lang: string): MultiInputVoiceKeyword[] {
  return getMultiInputKeywords(lang);
}

export function getControlKeywordPhrases(lang: string): ControlKeywords {
  return getControlKeywords(lang);
}

// --- Processing ---

/**
 * Apply simple keyword replacements to text.
 * Longer phrases are matched first (greedy). Case-insensitive.
 */
function applySimpleKeywords(text: string, keywords: VoiceKeyword[]): string {
  const sorted = [...keywords].sort((a, b) => b.phrase.length - a.phrase.length);
  let result = text;
  for (const kw of sorted) {
    const escaped = kw.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(regex, () => kw.replacement);
  }
  return result;
}

/**
 * Find all multi-input keyword occurrences, process right-to-left so inner
 * keywords consume their markers before outer keywords check for them.
 */
function processMultiInput(text: string, lang: string, simpleKws: VoiceKeyword[]): string {
  const multiKeywords = getMultiInputKeywords(lang);
  const controls = getControlKeywords(lang);

  if (multiKeywords.length === 0) return text;

  // Find all occurrences of all multi-input keywords
  interface Match {
    keyword: MultiInputVoiceKeyword;
    index: number;
    matchLength: number;
  }

  const matches: Match[] = [];
  for (const mk of multiKeywords) {
    const escaped = mk.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ keyword: mk, index: m.index, matchLength: m[0].length });
    }
  }

  if (matches.length === 0) return text;

  // Process rightmost first so index arithmetic stays valid
  matches.sort((a, b) => b.index - a.index);

  const lowerNextInput = controls.nextInput.toLowerCase();
  const lowerEndInput = controls.endInput.toLowerCase();

  for (const { keyword: mk, index: idx, matchLength } of matches) {
    const keywordEnd = idx + matchLength;
    const remaining = text.substring(keywordEnd);
    const lowerRemaining = remaining.toLowerCase();

    // Check if control markers exist after this keyword
    const hasMarker =
      lowerRemaining.includes(lowerNextInput) ||
      lowerRemaining.includes(lowerEndInput);

    if (!hasMarker) {
      // No markers — insert empty template
      const emptyTemplate = mk.template.replace(/\$\d+/g, "");
      text =
        text.substring(0, idx) +
        PROCESSED_START + emptyTemplate + PROCESSED_END +
        remaining;
      continue;
    }

    // Parse input segments between markers
    const inputs: string[] = [];
    let pos = 0;

    for (let i = 0; i < mk.inputs; i++) {
      const segment = remaining.substring(pos);
      const lowerSegment = segment.toLowerCase();

      const nextIdx = lowerSegment.indexOf(lowerNextInput);
      const endIdx = lowerSegment.indexOf(lowerEndInput);

      if (i < mk.inputs - 1 && nextIdx >= 0 && (endIdx < 0 || nextIdx < endIdx)) {
        // Not last slot, found "next input" before "end input"
        inputs.push(segment.substring(0, nextIdx).trim());
        pos += nextIdx + controls.nextInput.length;
      } else if (endIdx >= 0) {
        // Found "end input"
        inputs.push(segment.substring(0, endIdx).trim());
        pos += endIdx + controls.endInput.length;
        break;
      } else if (nextIdx >= 0) {
        // Only "next input" remains — use as terminator for last slot
        inputs.push(segment.substring(0, nextIdx).trim());
        pos += nextIdx + controls.nextInput.length;
        break;
      } else {
        // No more markers — take remaining text as last input
        inputs.push(segment.trim());
        pos = remaining.length;
        break;
      }
    }

    // Apply simple keywords within each input slot
    const processedInputs = inputs.map((inp) =>
      applySimpleKeywords(inp, simpleKws)
    );

    // Fill template slots
    let filled = mk.template;
    for (let i = 0; i < mk.inputs; i++) {
      filled = filled.replace(
        `$${i + 1}`,
        i < processedInputs.length ? processedInputs[i] : ""
      );
    }

    // Replace the keyword + consumed content in the text
    const before = text.substring(0, idx);
    const after = text.substring(keywordEnd + pos);
    text = before + PROCESSED_START + filled + PROCESSED_END + after;
  }

  return text;
}

/**
 * Processes a speech transcript by replacing voice keywords with LaTeX/formatting.
 *
 * Multi-input keywords (e.g. "summation ... next input ... end input") are
 * processed first. Their output is protected from double-replacement.
 * Then simple keywords run on the remaining text.
 *
 * Trailing punctuation (added by speech recognition) is stripped before processing.
 */
export function processTranscript(
  text: string,
  lang: string,
  customKeywords?: CustomKeyword[]
): string {
  // Strip trailing punctuation added by speech recognition
  text = text.replace(/[.,!?;:]+$/g, "");

  // Merge default + custom keywords
  const defaultKws = getKeywords(lang);
  const allSimple: VoiceKeyword[] = customKeywords
    ? [
        ...defaultKws,
        ...customKeywords.map((ck) => ({
          phrase: ck.phrase,
          replacement: ck.replacement,
          category: "operator" as const,
        })),
      ]
    : defaultKws;

  // Phase 1: Multi-input keywords (output wrapped in sentinel markers)
  let result = processMultiInput(text, lang, allSimple);

  // Phase 2: Simple keywords on non-processed segments only
  const sentinel = new RegExp(
    `(${PROCESSED_START}[\\s\\S]*?${PROCESSED_END})`,
    "g"
  );
  const parts = result.split(sentinel);
  result = parts
    .map((part) => {
      if (part.startsWith(PROCESSED_START) && part.endsWith(PROCESSED_END)) {
        return part.slice(1, -1); // Strip sentinel markers, keep content
      }
      return applySimpleKeywords(part, allSimple);
    })
    .join("");

  // Cleanup: spaces around newlines, double spaces, leading/trailing spaces
  result = result.replace(/ *\n */g, "\n");
  result = result.replace(/ {2,}/g, " ");

  return result.replace(/^ +| +$/g, "");
}
