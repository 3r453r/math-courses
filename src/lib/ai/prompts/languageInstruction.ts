const LANGUAGE_NAMES: Record<string, string> = {
  pl: "Polish",
};

export function buildLanguageInstruction(language: string): string {
  if (language === "en") return "";

  const langName = LANGUAGE_NAMES[language] ?? language;

  return `\n\nLANGUAGE REQUIREMENT:
You MUST generate ALL content entirely in ${langName}. This includes all titles, descriptions, explanations, quiz questions, choices, explanations, hints, and solutions. Use standard ${langName} mathematical terminology. The ONLY exceptions: LaTeX notation, variable names, and code syntax. Do NOT mix languages.`;
}
