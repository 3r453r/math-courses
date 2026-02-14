import { describe, it, expect } from "vitest";
import { getSpeechLang } from "./languageMap";

describe("getSpeechLang", () => {
  it('maps "en" to "en-US"', () => {
    expect(getSpeechLang("en")).toBe("en-US");
  });

  it('maps "pl" to "pl-PL"', () => {
    expect(getSpeechLang("pl")).toBe("pl-PL");
  });

  it('falls back to "{lang}-{LANG}" for unknown languages', () => {
    expect(getSpeechLang("de")).toBe("de-DE");
    expect(getSpeechLang("fr")).toBe("fr-FR");
    expect(getSpeechLang("es")).toBe("es-ES");
  });
});
