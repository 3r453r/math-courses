import { describe, it, expect } from "vitest";
import { buildVoiceInterpretationPrompt } from "./voiceInterpretation";

describe("buildVoiceInterpretationPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe("string");
  });

  it("includes math mode instruction when inMathMode is true", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: true,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("INSIDE a math expression");
    expect(prompt).toContain("raw LaTeX only");
  });

  it("includes prose mode instruction when inMathMode is false", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("writing prose");
    expect(prompt).toContain("$...$");
  });

  it("includes surrounding text when provided", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "the derivative of x squared",
      language: "en",
    });
    expect(prompt).toContain("the derivative of x squared");
    expect(prompt).toContain("Surrounding text");
  });

  it("omits surrounding text note when empty", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).not.toContain("Surrounding text");
  });

  it("includes Polish language note for pl", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "pl",
    });
    expect(prompt).toContain("Polish");
  });

  it("omits language note for English", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).not.toContain("Polish");
  });

  it("includes core rules about LaTeX conversion", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("x squared");
    expect(prompt).toContain("LaTeX");
    expect(prompt).toContain("speech recognition errors");
  });

  it("includes expanded misrecognition patterns", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("the green");
    expect(prompt).toContain("degree");
    expect(prompt).toContain("route");
    expect(prompt).toContain("root");
    expect(prompt).toContain("cosign");
    expect(prompt).toContain("cosine");
  });

  it("includes LaTeX formatting rules", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("LATEX FORMATTING RULES");
    expect(prompt).toContain("braces");
    expect(prompt).toContain("\\left(");
    expect(prompt).toContain("\\,");
  });

  it("emphasizes garbled speech interpretation", () => {
    const prompt = buildVoiceInterpretationPrompt({
      inMathMode: false,
      surroundingText: "",
      language: "en",
    });
    expect(prompt).toContain("garbled");
    expect(prompt).toContain("sounds like");
  });
});
