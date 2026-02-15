import { describe, it, expect } from "vitest";
import { buildLanguageInstruction } from "./languageInstruction";

describe("buildLanguageInstruction", () => {
  it('returns empty string for "en"', () => {
    expect(buildLanguageInstruction("en")).toBe("");
  });

  it('returns language instruction containing "Polish" and "LANGUAGE REQUIREMENT" for "pl"', () => {
    const result = buildLanguageInstruction("pl");
    expect(result).toContain("Polish");
    expect(result).toContain("LANGUAGE REQUIREMENT");
  });

  it("returns instruction using the raw language code for unknown languages", () => {
    const result = buildLanguageInstruction("unknown");
    expect(result).toContain("unknown");
    expect(result).toContain("LANGUAGE REQUIREMENT");
  });

  it("includes instruction to generate ALL content in the target language", () => {
    const result = buildLanguageInstruction("pl");
    expect(result).toContain("ALL content entirely in Polish");
  });

  it("mentions LaTeX as an exception", () => {
    const result = buildLanguageInstruction("pl");
    expect(result).toContain("LaTeX");
  });

  it("uses the raw code as language name when not in the lookup table", () => {
    const result = buildLanguageInstruction("xyz");
    expect(result).toContain("xyz");
    expect(result).toContain("LANGUAGE REQUIREMENT");
  });
});
