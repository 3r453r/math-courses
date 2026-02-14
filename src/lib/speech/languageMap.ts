const LANGUAGE_MAP: Record<string, string> = {
  en: "en-US",
  pl: "pl-PL",
};

/**
 * Maps an app language code to a BCP-47 speech recognition tag.
 * Falls back to `{lang}-{LANG}` for European languages (e.g. "de" → "de-DE").
 */
export function getSpeechLang(appLang: string): string {
  return LANGUAGE_MAP[appLang] ?? `${appLang}-${appLang.toUpperCase()}`;
}
