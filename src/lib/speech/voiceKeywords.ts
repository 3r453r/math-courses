// Sentinel markers to protect multi-input output from simple keyword processing
const PROCESSED_START = "\uE000";
const PROCESSED_END = "\uE001";

export interface VoiceKeyword {
  phrase: string;
  replacement: string;
  category: "latex" | "structure" | "formatting" | "greek" | "operator";
  /** Chars from end of replacement to place cursor (e.g., 1 for \sqrt{} puts cursor inside braces) */
  cursorOffset?: number;
}

export interface MultiInputVoiceKeyword {
  phrase: string;
  template: string; // uses $1, $2 for input slots
  inputs: number;
  category: string;
}

export interface ControlKeywords {
  endInput: string;
}

export interface CustomKeyword {
  phrase: string;
  replacement: string;
  mathOnly?: boolean;
}

export interface KeywordOverride {
  phrase?: string;    // undefined = use default, "" = disabled
  mathOnly?: boolean; // undefined = use default (false)
}

export interface VoiceConfig {
  overrides?: Record<string, KeywordOverride>;              // key: "en:alpha"
  controlOverrides?: Record<string, { endInput?: string }>;
  customKeywords?: CustomKeyword[];
  triggerEnabled?: boolean;
  triggerWord?: string;       // "" = use language default
  triggerEndWord?: string;    // "" = auto-derive from triggerWord
}

export interface ResolvedKeyword {
  key: string;
  defaultPhrase: string;
  effectivePhrase: string;
  replacement: string;
  category: string;
  disabled: boolean;
  cursorOffset?: number;
}

export interface ResolvedMultiInputKeyword {
  key: string;
  defaultPhrase: string;
  effectivePhrase: string;
  template: string;
  inputs: number;
  category: string;
  disabled: boolean;
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
  // Existing multi-input keywords
  { phrase: "summation", template: "\\sum_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "product over", template: "\\prod_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "integral from", template: "\\int_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "limit of", template: "\\lim_{$1}", inputs: 1, category: "operator" },
  { phrase: "fraction of", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
  // Migrated from simple keywords (were cursorOffset-based)
  { phrase: "superscript", template: "^{$1}", inputs: 1, category: "operator" },
  { phrase: "subscript", template: "_{$1}", inputs: 1, category: "operator" },
  { phrase: "fraction", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
  { phrase: "square root", template: "\\sqrt{$1}", inputs: 1, category: "operator" },
  { phrase: "nth root", template: "\\sqrt[$1]{$2}", inputs: 2, category: "operator" },
  { phrase: "partial derivative", template: "\\frac{\\partial $1}{\\partial $2}", inputs: 2, category: "operator" },
  { phrase: "vector", template: "\\vec{$1}", inputs: 1, category: "formatting" },
  { phrase: "hat accent", template: "\\hat{$1}", inputs: 1, category: "formatting" },
  { phrase: "bar accent", template: "\\bar{$1}", inputs: 1, category: "formatting" },
  { phrase: "overline", template: "\\overline{$1}", inputs: 1, category: "formatting" },
  { phrase: "text mode", template: "\\text{$1}", inputs: 1, category: "formatting" },
  { phrase: "math bold", template: "\\mathbf{$1}", inputs: 1, category: "formatting" },
  { phrase: "parentheses", template: "\\left( $1 \\right)", inputs: 1, category: "structure" },
  { phrase: "brackets", template: "\\left[ $1 \\right]", inputs: 1, category: "structure" },
  { phrase: "absolute value", template: "\\left| $1 \\right|", inputs: 1, category: "structure" },
  { phrase: "norm", template: "\\left\\| $1 \\right\\|", inputs: 1, category: "structure" },
];

const PL_MULTI_INPUT: MultiInputVoiceKeyword[] = [
  // Existing multi-input keywords
  { phrase: "sumowanie", template: "\\sum_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "iloczyn", template: "\\prod_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "całka od", template: "\\int_{$1}^{$2}", inputs: 2, category: "operator" },
  { phrase: "granica", template: "\\lim_{$1}", inputs: 1, category: "operator" },
  { phrase: "ułamek z", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
  // Migrated from simple keywords
  { phrase: "indeks górny", template: "^{$1}", inputs: 1, category: "operator" },
  { phrase: "indeks dolny", template: "_{$1}", inputs: 1, category: "operator" },
  { phrase: "ułamek", template: "\\frac{$1}{$2}", inputs: 2, category: "operator" },
  { phrase: "pierwiastek", template: "\\sqrt{$1}", inputs: 1, category: "operator" },
  { phrase: "pochodna cząstkowa", template: "\\frac{\\partial $1}{\\partial $2}", inputs: 2, category: "operator" },
  { phrase: "wektor", template: "\\vec{$1}", inputs: 1, category: "formatting" },
  { phrase: "daszek", template: "\\hat{$1}", inputs: 1, category: "formatting" },
  { phrase: "nadkreślenie", template: "\\overline{$1}", inputs: 1, category: "formatting" },
  { phrase: "tryb tekstowy", template: "\\text{$1}", inputs: 1, category: "formatting" },
  { phrase: "pogrubienie matematyczne", template: "\\mathbf{$1}", inputs: 1, category: "formatting" },
  { phrase: "nawiasy okrągłe", template: "\\left( $1 \\right)", inputs: 1, category: "structure" },
  { phrase: "nawiasy kwadratowe", template: "\\left[ $1 \\right]", inputs: 1, category: "structure" },
  { phrase: "wartość bezwzględna", template: "\\left| $1 \\right|", inputs: 1, category: "structure" },
];

const CONTROL_KEYWORDS: Record<string, ControlKeywords> = {
  en: { endInput: "next" },
  pl: { endInput: "koniec pola" },
};

// --- Trigger word defaults ---

const DEFAULT_TRIGGER_WORDS: Record<string, string> = {
  en: "mathematics",
  pl: "matematyka",
};

const DEFAULT_TRIGGER_END_WORDS: Record<string, string> = {
  en: "close mathematics",
  pl: "koniec matematyki",
};

const DEFAULT_TRIGGER_END_PREFIX: Record<string, string> = {
  en: "close ",
  pl: "koniec ",
};

export function getDefaultTriggerWord(lang: string): string {
  const effLang = getEffectiveLang(lang);
  return DEFAULT_TRIGGER_WORDS[effLang] ?? DEFAULT_TRIGGER_WORDS["en"]!;
}

export function getDefaultTriggerEndWord(lang: string): string {
  const effLang = getEffectiveLang(lang);
  return DEFAULT_TRIGGER_END_WORDS[effLang] ?? DEFAULT_TRIGGER_END_WORDS["en"]!;
}

// --- Misrecognition corrections (applied only in trigger zones) ---

interface CorrectionRule {
  heard: string;
  correction: string;
}

const EN_CORRECTIONS: CorrectionRule[] = [
  // Common speech recognition misrecognitions
  { heard: "the green", correction: "degree" },
  { heard: "route", correction: "root" },
  { heard: "cosign", correction: "cosine" },
  { heard: "sigh", correction: "psi" },
  { heard: "fee", correction: "phi" },
  { heard: "pie", correction: "pi" },
  { heard: "mew", correction: "mu" },
  // Number words → digits (in math context, after trigger)
  { heard: "zero", correction: "0" },
  { heard: "one", correction: "1" },
  { heard: "two", correction: "2" },
  { heard: "three", correction: "3" },
  { heard: "four", correction: "4" },
  { heard: "five", correction: "5" },
  { heard: "six", correction: "6" },
  { heard: "seven", correction: "7" },
  { heard: "eight", correction: "8" },
  { heard: "nine", correction: "9" },
  { heard: "ten", correction: "10" },
];

const PL_CORRECTIONS: CorrectionRule[] = [
  // Polish misrecognitions
  { heard: "zero", correction: "0" },
  { heard: "jeden", correction: "1" },
  { heard: "dwa", correction: "2" },
  { heard: "trzy", correction: "3" },
  { heard: "cztery", correction: "4" },
  { heard: "pięć", correction: "5" },
  { heard: "sześć", correction: "6" },
  { heard: "siedem", correction: "7" },
  { heard: "osiem", correction: "8" },
  { heard: "dziewięć", correction: "9" },
  { heard: "dziesięć", correction: "10" },
];

const CORRECTIONS_MAP: Record<string, CorrectionRule[]> = {
  en: EN_CORRECTIONS,
  pl: PL_CORRECTIONS,
};

function getCorrections(lang: string): CorrectionRule[] {
  return CORRECTIONS_MAP[lang] ?? CORRECTIONS_MAP["en"] ?? [];
}

/**
 * Apply misrecognition corrections to text. Case-insensitive with word boundaries.
 * Only used within trigger zones (math context).
 */
export function applyCorrections(text: string, lang: string): string {
  const corrections = getCorrections(lang);
  let result = text;
  // Sort by heard phrase length descending (longer phrases first)
  const sorted = [...corrections].sort((a, b) => b.heard.length - a.heard.length);
  for (const rule of sorted) {
    const escaped = rule.heard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    result = result.replace(regex, rule.correction);
  }
  return result;
}

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

/** Returns lang if it has a keyword map, else "en" */
export function getEffectiveLang(lang: string): string {
  return KEYWORD_MAPS[lang] ? lang : "en";
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

// --- Resolve functions for config UI + processing ---

export function resolveSimpleKeywords(
  lang: string,
  overrides?: Record<string, KeywordOverride>
): ResolvedKeyword[] {
  const effLang = getEffectiveLang(lang);
  const defaults = getKeywords(effLang);
  return defaults.map((kw) => {
    const key = `${effLang}:${kw.phrase}`;
    const ov = overrides?.[key];
    const effectivePhrase = ov?.phrase !== undefined ? ov.phrase : kw.phrase;
    return {
      key,
      defaultPhrase: kw.phrase,
      effectivePhrase,
      replacement: kw.replacement,
      category: kw.category,
      disabled: effectivePhrase === "",
      cursorOffset: kw.cursorOffset,
    };
  });
}

export function resolveMultiInputKeywords(
  lang: string,
  overrides?: Record<string, KeywordOverride>
): ResolvedMultiInputKeyword[] {
  const effLang = getEffectiveLang(lang);
  const defaults = getMultiInputKeywords(effLang);
  return defaults.map((mk) => {
    const key = `${effLang}:multi:${mk.phrase}`;
    const ov = overrides?.[key];
    const effectivePhrase = ov?.phrase !== undefined ? ov.phrase : mk.phrase;
    return {
      key,
      defaultPhrase: mk.phrase,
      effectivePhrase,
      template: mk.template,
      inputs: mk.inputs,
      category: mk.category,
      disabled: effectivePhrase === "",
    };
  });
}

export function resolveControlKeywords(
  lang: string,
  controlOverrides?: Record<string, { endInput?: string }>
): ControlKeywords {
  const effLang = getEffectiveLang(lang);
  const defaults = getControlKeywords(effLang);
  const ov = controlOverrides?.[effLang];
  return {
    endInput: ov?.endInput !== undefined && ov.endInput !== "" ? ov.endInput : defaults.endInput,
  };
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
function processMultiInput(
  text: string,
  multiKeywords: MultiInputVoiceKeyword[],
  controls: ControlKeywords,
  simpleKws: VoiceKeyword[]
): string {
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
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ keyword: mk, index: m.index, matchLength: m[0].length });
    }
  }

  if (matches.length === 0) return text;

  // When multiple keywords match at the same position, keep only the longest
  // (e.g., "fraction of" should take priority over "fraction")
  matches.sort((a, b) => a.index - b.index || b.matchLength - a.matchLength);
  const deduped: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.index >= lastEnd) {
      deduped.push(m);
      lastEnd = m.index + m.matchLength;
    }
  }

  // Process rightmost first so index arithmetic stays valid
  deduped.sort((a, b) => b.index - a.index);
  const dedupedMatches = deduped;

  const lowerEndInput = controls.endInput.toLowerCase();

  for (const { keyword: mk, index: idx, matchLength } of dedupedMatches) {
    const keywordEnd = idx + matchLength;
    const remaining = text.substring(keywordEnd);
    const lowerRemaining = remaining.toLowerCase();

    // Check if control markers exist after this keyword
    const hasMarker = lowerRemaining.includes(lowerEndInput);

    if (!hasMarker) {
      // No markers — insert empty template
      const emptyTemplate = mk.template.replace(/\$\d+/g, "");
      text =
        text.substring(0, idx) +
        PROCESSED_START + emptyTemplate + PROCESSED_END +
        remaining;
      continue;
    }

    // Parse input segments between "end input" delimiters.
    // Each "end input" closes the current slot and advances to the next one.
    // After all slots are filled, remaining text continues as normal prose.
    const inputs: string[] = [];
    let pos = 0;

    for (let i = 0; i < mk.inputs; i++) {
      const segment = remaining.substring(pos);
      const lowerSegment = segment.toLowerCase();

      const endIdx = lowerSegment.indexOf(lowerEndInput);

      if (endIdx >= 0) {
        inputs.push(segment.substring(0, endIdx).trim());
        pos += endIdx + controls.endInput.length;
      } else {
        // No more delimiters — take remaining text as last input
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
 * Core keyword processing: multi-input → simple.
 * Does NOT handle trigger word splitting — that's done by processTranscript.
 */
function processKeywordsCore(
  text: string,
  keywords: VoiceKeyword[],
  effectiveMulti: MultiInputVoiceKeyword[],
  controls: ControlKeywords
): string {
  // Phase 1: Multi-input keywords (output wrapped in sentinel markers)
  let result = processMultiInput(text, effectiveMulti, controls, keywords);

  // Phase 2: Simple keywords on non-processed segments
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
      return applySimpleKeywords(part, keywords);
    })
    .join("");

  return result;
}

/**
 * Split text into prose and math zones based on trigger/end-trigger words.
 * Returns array of { text, isMath } segments.
 */
export function splitByTrigger(
  text: string,
  triggerWord: string,
  endTriggerWord: string
): Array<{ text: string; isMath: boolean }> {
  const segments: Array<{ text: string; isMath: boolean }> = [];
  const lower = text.toLowerCase();
  const lowerTrigger = triggerWord.toLowerCase();
  const lowerEnd = endTriggerWord.toLowerCase();
  let pos = 0;

  while (pos < text.length) {
    // Find next trigger word
    const triggerIdx = lower.indexOf(lowerTrigger, pos);

    if (triggerIdx < 0) {
      // No more triggers — rest is prose
      segments.push({ text: text.substring(pos), isMath: false });
      break;
    }

    // Text before trigger is prose
    if (triggerIdx > pos) {
      segments.push({ text: text.substring(pos, triggerIdx), isMath: false });
    }

    // Consume trigger word
    const afterTrigger = triggerIdx + triggerWord.length;

    // Find end trigger
    const endIdx = lower.indexOf(lowerEnd, afterTrigger);

    if (endIdx < 0) {
      // No end trigger — rest of text after trigger is math
      segments.push({ text: text.substring(afterTrigger), isMath: true });
      pos = text.length;
    } else {
      // Math zone between trigger and end trigger
      segments.push({ text: text.substring(afterTrigger, endIdx), isMath: true });
      // Consume end trigger word
      pos = endIdx + endTriggerWord.length;
    }
  }

  return segments;
}

/**
 * Processes a speech transcript by replacing voice keywords with LaTeX/formatting.
 *
 * Multi-input keywords (e.g. "summation ... end input ... end input") are
 * processed first. Their output is protected from double-replacement.
 * Then simple keywords run on the remaining text.
 * Finally, mathOnly keywords are applied only within $ regions.
 *
 * When trigger mode is enabled, only text after the trigger word gets keyword-processed.
 * Misrecognition corrections are also applied only in triggered zones.
 *
 * Trailing punctuation (added by speech recognition) is stripped before processing.
 */
export function processTranscript(
  text: string,
  lang: string,
  configOrCustom?: VoiceConfig | CustomKeyword[]
): string {
  // Backward compatibility: array of CustomKeyword[] → wrap as VoiceConfig
  let config: VoiceConfig | undefined;
  if (Array.isArray(configOrCustom)) {
    config = { customKeywords: configOrCustom };
  } else {
    config = configOrCustom;
  }

  // Strip trailing punctuation added by speech recognition
  text = text.replace(/[.,!?;:]+$/g, "");

  const effLang = getEffectiveLang(lang);

  // Build effective simple keywords from defaults + overrides
  const resolved = resolveSimpleKeywords(effLang, config?.overrides);
  const keywords: VoiceKeyword[] = [];

  for (const r of resolved) {
    if (r.disabled) continue;
    keywords.push({
      phrase: r.effectivePhrase,
      replacement: r.replacement,
      category: r.category as VoiceKeyword["category"],
    });
  }

  // Add custom keywords
  if (config?.customKeywords) {
    for (const ck of config.customKeywords) {
      keywords.push({
        phrase: ck.phrase,
        replacement: ck.replacement,
        category: "operator",
      });
    }
  }

  // Build effective multi-input keywords
  const resolvedMulti = resolveMultiInputKeywords(effLang, config?.overrides);
  const effectiveMulti: MultiInputVoiceKeyword[] = resolvedMulti
    .filter((r) => !r.disabled)
    .map((r) => ({
      phrase: r.effectivePhrase,
      template: r.template,
      inputs: r.inputs,
      category: r.category,
    }));

  // Build effective control keywords
  const controls = resolveControlKeywords(effLang, config?.controlOverrides);

  let result: string;

  if (config?.triggerEnabled) {
    // Trigger mode: split by trigger/end-trigger, process only math zones
    const triggerWord = config.triggerWord || getDefaultTriggerWord(effLang);
    const endPrefix = DEFAULT_TRIGGER_END_PREFIX[effLang] ?? DEFAULT_TRIGGER_END_PREFIX["en"]!;
    const endTriggerWord = config.triggerEndWord || (config.triggerWord ? endPrefix + config.triggerWord : getDefaultTriggerEndWord(effLang));
    const segments = splitByTrigger(text, triggerWord, endTriggerWord);

    result = segments
      .map((seg) => {
        if (!seg.isMath) return seg.text;
        // Apply corrections in math zones only
        let processed = applyCorrections(seg.text, effLang);
        // Apply keyword processing
        processed = processKeywordsCore(processed, keywords, effectiveMulti, controls);
        return processed;
      })
      .join("");
  } else {
    // Non-trigger mode: process entire text
    result = processKeywordsCore(text, keywords, effectiveMulti, controls);
  }

  // Cleanup: spaces around newlines, double spaces, leading/trailing spaces
  result = result.replace(/ *\n */g, "\n");
  result = result.replace(/ {2,}/g, " ");

  return result.replace(/^ +| +$/g, "");
}

/**
 * Like processTranscript but also returns a cursorOffset.
 * Since all brace-containing keywords are now multi-input templates,
 * cursorOffset is always 0 (cursor goes to end of inserted text).
 */
export function processTranscriptWithCursor(
  text: string,
  lang: string,
  configOrCustom?: VoiceConfig | CustomKeyword[]
): { text: string; cursorOffset: number } {
  return { text: processTranscript(text, lang, configOrCustom), cursorOffset: 0 };
}
