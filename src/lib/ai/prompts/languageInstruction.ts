export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  pl: "Polish",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  cs: "Czech",
  sk: "Slovak",
  uk: "Ukrainian",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  ro: "Romanian",
  hu: "Hungarian",
  el: "Greek",
  he: "Hebrew",
};

export function buildLanguageInstruction(language: string): string {
  if (language === "en") return "";

  const langName = LANGUAGE_NAMES[language] ?? language;

  return `\n\nLANGUAGE REQUIREMENT:
You MUST generate ALL content entirely in ${langName}. This includes all titles, descriptions, explanations, quiz questions, choices, explanations, hints, and solutions. Use standard ${langName} mathematical terminology. The ONLY exceptions: LaTeX notation, variable names, and code syntax. Do NOT mix languages.`;
}
