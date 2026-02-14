import { describe, it, expect } from "vitest";
import {
  processTranscript,
  processTranscriptWithCursor,
  resolveSimpleKeywords,
  resolveControlKeywords,
  applyCorrections,
  splitByTrigger,
} from "./voiceKeywords";
import type { VoiceConfig } from "./voiceKeywords";

describe("processTranscript", () => {
  describe("English keywords", () => {
    it("replaces mathematics open/close with dollar signs", () => {
      expect(processTranscript("mathematics open x mathematics close", "en")).toBe("$ x $");
    });

    it("replaces superscript keyword (empty template, no next)", () => {
      expect(processTranscript("x superscript 2", "en")).toBe("x ^{} 2");
    });

    it("converts a full spoken equation", () => {
      const input = "mathematics open x superscript 2 next mathematics close";
      const result = processTranscript(input, "en");
      expect(result).toBe("$ x ^{2} $");
    });

    it("replaces display math delimiters", () => {
      const input = "display mathematics open x display mathematics close";
      const result = processTranscript(input, "en");
      expect(result).toContain("$$");
      expect(result).toContain("x");
    });

    it("replaces fraction keyword (empty template)", () => {
      expect(processTranscript("fraction", "en")).toBe("\\frac{}{}");
    });

    it("replaces square root keyword (empty template)", () => {
      expect(processTranscript("square root", "en")).toBe("\\sqrt{}");
    });

    it("replaces integral keyword", () => {
      expect(processTranscript("integral", "en")).toBe("\\int");
    });

    it("replaces greek letters", () => {
      expect(processTranscript("alpha", "en")).toBe("\\alpha");
      expect(processTranscript("beta", "en")).toBe("\\beta");
      expect(processTranscript("pi", "en")).toBe("\\pi");
      expect(processTranscript("theta", "en")).toBe("\\theta");
    });

    it("replaces formatting keywords", () => {
      expect(processTranscript("hello new line world", "en")).toContain("\n");
      expect(processTranscript("hello new paragraph world", "en")).toContain("\n\n");
      expect(processTranscript("bold", "en")).toBe("**");
      expect(processTranscript("italic", "en")).toBe("*");
    });

    it("replaces brace keywords", () => {
      expect(processTranscript("open brace x close brace", "en")).toBe("{ x }");
    });

    it("replaces operator keywords", () => {
      expect(processTranscript("infinity", "en")).toBe("\\infty");
      expect(processTranscript("times", "en")).toBe("\\times");
      expect(processTranscript("plus minus", "en")).toBe("\\pm");
    });

    it("replaces arrow and logic keywords", () => {
      expect(processTranscript("right arrow", "en")).toBe("\\to");
      expect(processTranscript("implies", "en")).toBe("\\implies");
      expect(processTranscript("for all", "en")).toBe("\\forall");
      expect(processTranscript("there exists", "en")).toBe("\\exists");
      expect(processTranscript("element of", "en")).toBe("\\in");
    });

    it("replaces set keywords", () => {
      expect(processTranscript("subset", "en")).toBe("\\subset");
      expect(processTranscript("union", "en")).toBe("\\cup");
      expect(processTranscript("intersection", "en")).toBe("\\cap");
      expect(processTranscript("empty set", "en")).toBe("\\emptyset");
      expect(processTranscript("real numbers", "en")).toBe("\\mathbb{R}");
    });

    it("replaces formatting/accent keywords (empty templates)", () => {
      expect(processTranscript("vector", "en")).toBe("\\vec{}");
      expect(processTranscript("hat accent", "en")).toBe("\\hat{}");
      expect(processTranscript("overline", "en")).toBe("\\overline{}");
      expect(processTranscript("text mode", "en")).toBe("\\text{}");
    });

    it("replaces delimiter keywords (empty templates)", () => {
      expect(processTranscript("parentheses", "en")).toBe("\\left( \\right)");
      expect(processTranscript("absolute value", "en")).toBe("\\left| \\right|");
    });
  });

  describe("Polish keywords", () => {
    it("replaces Polish math delimiters", () => {
      expect(processTranscript("matematyka otwórz x matematyka zamknij", "pl")).toBe("$ x $");
    });

    it("replaces Polish superscript (empty template)", () => {
      expect(processTranscript("indeks górny", "pl")).toBe("^{}");
    });

    it("replaces Polish subscript (empty template)", () => {
      expect(processTranscript("indeks dolny", "pl")).toBe("_{}");
    });

    it("replaces Polish fraction (empty template)", () => {
      expect(processTranscript("ułamek", "pl")).toBe("\\frac{}{}");
    });

    it("replaces Polish greek letters", () => {
      expect(processTranscript("alfa", "pl")).toBe("\\alpha");
      expect(processTranscript("sigma", "pl")).toBe("\\sigma");
    });

    it("replaces Polish formatting in context", () => {
      expect(processTranscript("hello nowa linia world", "pl")).toContain("\n");
      expect(processTranscript("hello nowy akapit world", "pl")).toContain("\n\n");
    });

    it("replaces Polish display math", () => {
      const input = "wzór otwórz x wzór zamknij";
      const result = processTranscript(input, "pl");
      expect(result).toContain("$$");
    });
  });

  describe("case insensitivity", () => {
    it("matches keywords regardless of case", () => {
      expect(processTranscript("Mathematics Open x Mathematics Close", "en")).toBe("$ x $");
      expect(processTranscript("ALPHA", "en")).toBe("\\alpha");
      expect(processTranscript("Square Root", "en")).toBe("\\sqrt{}");
    });
  });

  describe("longer phrases matched first", () => {
    it("matches 'display mathematics open' before 'mathematics open'", () => {
      const result = processTranscript("display mathematics open", "en");
      expect(result).toContain("$$");
      // Should NOT be just "$" (which would mean only "mathematics open" matched)
      expect(result).not.toBe("display $");
    });

    it("matches 'new paragraph' before 'new line' in context", () => {
      const result = processTranscript("hello new paragraph world", "en");
      expect(result).toContain("\n\n");
    });

    it("matches 'square root' as one keyword", () => {
      const result = processTranscript("square root", "en");
      expect(result).toBe("\\sqrt{}");
    });

    it("matches 'less than or equal' as one keyword", () => {
      const result = processTranscript("less than or equal", "en");
      expect(result).toBe("\\leq");
    });
  });

  describe("plain prose passthrough", () => {
    it("passes through normal text unmodified", () => {
      expect(processTranscript("this is a normal sentence", "en")).toBe(
        "this is a normal sentence"
      );
    });

    it("handles mixed prose and keywords", () => {
      const input = "the value of alpha is important";
      const result = processTranscript(input, "en");
      expect(result).toBe("the value of \\alpha is important");
    });
  });

  describe("fallback language", () => {
    it("falls back to English keywords for unknown languages", () => {
      expect(processTranscript("mathematics open x mathematics close", "de")).toBe("$ x $");
    });
  });

  describe("whitespace cleanup", () => {
    it("collapses multiple spaces to single space", () => {
      expect(processTranscript("a  b   c", "en")).toBe("a b c");
    });

    it("trims leading and trailing spaces", () => {
      expect(processTranscript("  hello  ", "en")).toBe("hello");
    });

    it("preserves newlines from keyword replacements", () => {
      const result = processTranscript("hello new line world", "en");
      expect(result).toBe("hello\nworld");
    });
  });

  describe("punctuation stripping", () => {
    it("strips trailing period from speech recognition", () => {
      expect(processTranscript("alpha.", "en")).toBe("\\alpha");
    });

    it("strips trailing comma", () => {
      expect(processTranscript("square root,", "en")).toBe("\\sqrt{}");
    });

    it("strips trailing exclamation mark", () => {
      expect(processTranscript("fraction!", "en")).toBe("\\frac{}{}");
    });

    it("strips multiple trailing punctuation", () => {
      expect(processTranscript("alpha...", "en")).toBe("\\alpha");
    });

    it("does not strip punctuation in the middle of text", () => {
      expect(processTranscript("a.b", "en")).toBe("a.b");
    });
  });

  describe("custom keywords", () => {
    it("applies custom keywords alongside defaults", () => {
      const custom = [{ phrase: "my symbol", replacement: "\\mysymbol" }];
      expect(processTranscript("my symbol", "en", custom)).toBe("\\mysymbol");
    });

    it("custom keywords do not override defaults", () => {
      const custom = [{ phrase: "my symbol", replacement: "\\mysymbol" }];
      expect(processTranscript("alpha my symbol", "en", custom)).toBe(
        "\\alpha \\mysymbol"
      );
    });

    it("works with empty custom array", () => {
      expect(processTranscript("alpha", "en", [])).toBe("\\alpha");
    });
  });

  describe("multi-input keywords", () => {
    it("fills summation template with two inputs", () => {
      const input = "summation i next n next";
      expect(processTranscript(input, "en")).toBe("\\sum_{i}^{n}");
    });

    it("processes simple keywords inside input slots", () => {
      const input = "summation alpha next beta next";
      expect(processTranscript(input, "en")).toBe("\\sum_{\\alpha}^{\\beta}");
    });

    it("fills fraction of template", () => {
      const input = "fraction of a next b next";
      expect(processTranscript(input, "en")).toBe("\\frac{a}{b}");
    });

    it("fills single-input template (limit)", () => {
      const input = "limit of x next";
      expect(processTranscript(input, "en")).toBe("\\lim_{x}");
    });

    it("fills integral from template", () => {
      const input = "integral from 0 next infinity next";
      expect(processTranscript(input, "en")).toBe("\\int_{0}^{\\infty}");
    });

    it("fills product template", () => {
      const input = "product over k next n next";
      expect(processTranscript(input, "en")).toBe("\\prod_{k}^{n}");
    });

    it("inserts empty template when no markers follow", () => {
      expect(processTranscript("summation", "en")).toBe("\\sum_{}^{}");
    });

    it("leaves second slot empty when only one next is used", () => {
      const input = "summation i next";
      expect(processTranscript(input, "en")).toBe("\\sum_{i}^{}");
    });

    it("preserves surrounding text", () => {
      const input = "the summation i next n next is finite";
      expect(processTranscript(input, "en")).toBe(
        "the \\sum_{i}^{n} is finite"
      );
    });

    it("handles case-insensitive multi-input keywords", () => {
      const input = "Summation I Next N Next";
      expect(processTranscript(input, "en")).toBe("\\sum_{I}^{N}");
    });

    it("does not double-process keywords in template output", () => {
      const input = "summation pi next 1 next";
      const result = processTranscript(input, "en");
      expect(result).toBe("\\sum_{\\pi}^{1}");
      expect(result).not.toContain("\\\\");
    });

    it("uses next as separator between slots", () => {
      const input = "summation 2a next 3 pi next 2x";
      expect(processTranscript(input, "en")).toBe("\\sum_{2a}^{3 \\pi} 2x");
    });

    it("uses next as separator for fraction of", () => {
      const input = "fraction of a next b next rest";
      expect(processTranscript(input, "en")).toBe("\\frac{a}{b} rest");
    });

    it("uses next as separator and preserves surrounding text", () => {
      const input = "the summation i next n next is finite";
      expect(processTranscript(input, "en")).toBe(
        "the \\sum_{i}^{n} is finite"
      );
    });

    it("fills last slot without trailing next", () => {
      const input = "summation a next b";
      expect(processTranscript(input, "en")).toBe("\\sum_{a}^{b}");
    });

    it("processes keywords inside slots with next separator", () => {
      const input = "integral from 0 next infinity next";
      expect(processTranscript(input, "en")).toBe("\\int_{0}^{\\infty}");
    });

    describe("migrated brace keywords as multi-input", () => {
      it("fills square root with content", () => {
        const input = "square root 2x next + 3";
        expect(processTranscript(input, "en")).toBe("\\sqrt{2x} + 3");
      });

      it("fills parentheses with content", () => {
        const input = "parentheses a + b next squared";
        expect(processTranscript(input, "en")).toBe("\\left( a + b \\right) squared");
      });

      it("fills vector with content", () => {
        const input = "vector v next = 0";
        expect(processTranscript(input, "en")).toBe("\\vec{v} = 0");
      });

      it("fills superscript with content", () => {
        const input = "x superscript 2 next";
        expect(processTranscript(input, "en")).toBe("x ^{2}");
      });

      it("fills subscript with content", () => {
        const input = "a subscript n next";
        expect(processTranscript(input, "en")).toBe("a _{n}");
      });

      it("fills fraction template with two inputs", () => {
        const input = "fraction a next b next";
        expect(processTranscript(input, "en")).toBe("\\frac{a}{b}");
      });

      it("fills nth root template", () => {
        const input = "nth root 3 next 8 next";
        expect(processTranscript(input, "en")).toBe("\\sqrt[3]{8}");
      });

      it("fills hat accent with content", () => {
        const input = "hat accent x next";
        expect(processTranscript(input, "en")).toBe("\\hat{x}");
      });

      it("fills bar accent with content", () => {
        const input = "bar accent x next";
        expect(processTranscript(input, "en")).toBe("\\bar{x}");
      });

      it("fills overline with content", () => {
        const input = "overline AB next";
        expect(processTranscript(input, "en")).toBe("\\overline{AB}");
      });

      it("fills text mode with content", () => {
        const input = "text mode hello world next";
        expect(processTranscript(input, "en")).toBe("\\text{hello world}");
      });

      it("fills math bold with content", () => {
        const input = "math bold v next";
        expect(processTranscript(input, "en")).toBe("\\mathbf{v}");
      });

      it("fills brackets with content", () => {
        const input = "brackets x next";
        expect(processTranscript(input, "en")).toBe("\\left[ x \\right]");
      });

      it("fills absolute value with content", () => {
        const input = "absolute value x next";
        expect(processTranscript(input, "en")).toBe("\\left| x \\right|");
      });

      it("fills norm with content", () => {
        const input = "norm v next";
        expect(processTranscript(input, "en")).toBe("\\left\\| v \\right\\|");
      });

      it("fills partial derivative with two inputs", () => {
        const input = "partial derivative f next x next";
        expect(processTranscript(input, "en")).toBe("\\frac{\\partial f}{\\partial x}");
      });
    });

    describe("Polish multi-input", () => {
      it("fills summation template in Polish", () => {
        const input = "sumowanie alfa koniec pola n koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\sum_{\\alpha}^{n}");
      });

      it("fills fraction template in Polish", () => {
        const input = "ułamek z a koniec pola b koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\frac{a}{b}");
      });

      it("fills limit template in Polish", () => {
        const input = "granica x koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\lim_{x}");
      });

      it("inserts empty template in Polish when no markers", () => {
        expect(processTranscript("sumowanie", "pl")).toBe("\\sum_{}^{}");
      });

      it("uses koniec pola as separator in Polish", () => {
        const input = "sumowanie alfa koniec pola n koniec pola reszta";
        expect(processTranscript(input, "pl")).toBe("\\sum_{\\alpha}^{n} reszta");
      });

      it("fills Polish square root with content", () => {
        const input = "pierwiastek 2x koniec pola + 3";
        expect(processTranscript(input, "pl")).toBe("\\sqrt{2x} + 3");
      });
    });
  });

  describe("VoiceConfig overrides", () => {
    it("uses overridden phrase for matching", () => {
      const config: VoiceConfig = {
        overrides: { "en:alpha": { phrase: "letter a" } },
      };
      expect(processTranscript("letter a", "en", config)).toBe("\\alpha");
      // Original phrase should no longer match
      expect(processTranscript("alpha", "en", config)).toBe("alpha");
    });

    it("disables keyword when phrase is empty string", () => {
      const config: VoiceConfig = {
        overrides: { "en:alpha": { phrase: "" } },
      };
      // "alpha" should pass through unchanged
      expect(processTranscript("alpha", "en", config)).toBe("alpha");
    });

    it("backward compatible with no config", () => {
      expect(processTranscript("alpha", "en")).toBe("\\alpha");
      expect(processTranscript("alpha", "en", undefined)).toBe("\\alpha");
    });

    it("backward compatible with empty VoiceConfig", () => {
      expect(processTranscript("alpha", "en", {})).toBe("\\alpha");
    });

    it("backward compatible with CustomKeyword[] array", () => {
      const custom = [{ phrase: "my sym", replacement: "\\sym" }];
      expect(processTranscript("my sym", "en", custom)).toBe("\\sym");
    });

    it("overrides multi-input keyword phrase", () => {
      const config: VoiceConfig = {
        overrides: { "en:multi:summation": { phrase: "add up" } },
      };
      expect(processTranscript("add up i next n next", "en", config)).toBe(
        "\\sum_{i}^{n}"
      );
      // Original phrase should not trigger multi-input
      expect(processTranscript("summation i next n next", "en", config)).toBe(
        "summation i next n next"
      );
    });

    it("disables multi-input keyword when phrase is empty", () => {
      const config: VoiceConfig = {
        overrides: { "en:multi:summation": { phrase: "" } },
      };
      const result = processTranscript("summation", "en", config);
      expect(result).toBe("summation");
    });
  });

  describe("control keyword overrides", () => {
    it("uses custom end phrase", () => {
      const config: VoiceConfig = {
        controlOverrides: { en: { endInput: "done" } },
      };
      const input = "summation i done n done";
      expect(processTranscript(input, "en", config)).toBe("\\sum_{i}^{n}");
    });

    it("falls back to default when override is empty string", () => {
      const config: VoiceConfig = {
        controlOverrides: { en: { endInput: "" } },
      };
      const input = "summation i next n next";
      expect(processTranscript(input, "en", config)).toBe("\\sum_{i}^{n}");
    });
  });

  describe("trigger word processing", () => {
    it("processes only text after trigger word", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "I need mathematics alpha plus beta close mathematics";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("I need \\alpha plus \\beta");
    });

    it("passes through prose before trigger unchanged", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "this is prose mathematics alpha close mathematics more prose";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("this is prose \\alpha more prose");
    });

    it("supports multiple trigger zones", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "a mathematics alpha close mathematics b mathematics beta close mathematics c";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("a \\alpha b \\beta c");
    });

    it("processes to end of text when no end trigger found", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "start mathematics alpha plus beta";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("start \\alpha plus \\beta");
    });

    it("uses custom trigger word", () => {
      const config: VoiceConfig = { triggerEnabled: true, triggerWord: "math mode" };
      const input = "prose math mode alpha close math mode rest";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("prose \\alpha rest");
    });

    it("applies corrections only in trigger zones", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      // "pie" should be corrected to "pi" → "\pi" in math zone
      const input = "I like pie mathematics pie close mathematics and more pie";
      const result = processTranscript(input, "en", config);
      // "pie" in prose stays as "pie", "pie" in math zone → "pi" → "\pi"
      expect(result).toBe("I like pie \\pi and more pie");
    });

    it("does not apply corrections when trigger is disabled", () => {
      const input = "pie is tasty";
      const result = processTranscript(input, "en");
      // Without trigger, "pie" is not corrected (it's not a keyword)
      expect(result).toBe("pie is tasty");
    });

    it("applies corrections for misrecognized words in math zone", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "mathematics the green close mathematics";
      const result = processTranscript(input, "en", config);
      // "the green" → "degree" (correction), but "degree" is not a keyword, so stays
      expect(result).toBe("degree");
    });

    it("works with Polish trigger word", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "tekst matematyka alfa koniec matematyki reszta";
      const result = processTranscript(input, "pl", config);
      expect(result).toBe("tekst \\alpha reszta");
    });

    it("combines trigger with multi-input keywords", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "mathematics square root 2x next + 3 close mathematics";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("\\sqrt{2x} + 3");
    });

    it("number word corrections in math zone", () => {
      const config: VoiceConfig = { triggerEnabled: true };
      const input = "mathematics two plus three close mathematics";
      const result = processTranscript(input, "en", config);
      expect(result).toBe("2 plus 3");
    });
  });
});

describe("resolveSimpleKeywords", () => {
  it("returns all defaults with no overrides", () => {
    const resolved = resolveSimpleKeywords("en");
    expect(resolved.length).toBeGreaterThan(0);
    const alpha = resolved.find((r) => r.defaultPhrase === "alpha");
    expect(alpha).toBeDefined();
    expect(alpha!.effectivePhrase).toBe("alpha");
    expect(alpha!.disabled).toBe(false);
  });

  it("applies phrase override", () => {
    const resolved = resolveSimpleKeywords("en", {
      "en:alpha": { phrase: "letter a" },
    });
    const alpha = resolved.find((r) => r.defaultPhrase === "alpha");
    expect(alpha!.effectivePhrase).toBe("letter a");
    expect(alpha!.disabled).toBe(false);
  });

  it("marks disabled when phrase is empty", () => {
    const resolved = resolveSimpleKeywords("en", {
      "en:alpha": { phrase: "" },
    });
    const alpha = resolved.find((r) => r.defaultPhrase === "alpha");
    expect(alpha!.effectivePhrase).toBe("");
    expect(alpha!.disabled).toBe(true);
  });

  it("falls back to English for unknown language", () => {
    const resolved = resolveSimpleKeywords("de");
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved[0].key).toMatch(/^en:/);
  });
});

describe("resolveControlKeywords", () => {
  it("returns defaults with no overrides", () => {
    const controls = resolveControlKeywords("en");
    expect(controls.endInput).toBe("next");
  });

  it("applies overrides", () => {
    const controls = resolveControlKeywords("en", {
      en: { endInput: "done" },
    });
    expect(controls.endInput).toBe("done");
  });

  it("falls back to default when override is empty", () => {
    const controls = resolveControlKeywords("en", {
      en: { endInput: "" },
    });
    expect(controls.endInput).toBe("next");
  });
});

describe("processTranscriptWithCursor", () => {
  it("returns cursorOffset 0 for all inputs (no simple keywords have cursor offset)", () => {
    const result = processTranscriptWithCursor("alpha", "en");
    expect(result.text).toBe("\\alpha");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 for parentheses (now multi-input)", () => {
    const result = processTranscriptWithCursor("parentheses", "en");
    expect(result.text).toBe("\\left( \\right)");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 for fraction (now multi-input)", () => {
    const result = processTranscriptWithCursor("fraction", "en");
    expect(result.text).toBe("\\frac{}{}");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 for square root (now multi-input)", () => {
    const result = processTranscriptWithCursor("square root", "en");
    expect(result.text).toBe("\\sqrt{}");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 for superscript (now multi-input)", () => {
    const result = processTranscriptWithCursor("superscript", "en");
    expect(result.text).toBe("^{}");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 for subscript (now multi-input)", () => {
    const result = processTranscriptWithCursor("subscript", "en");
    expect(result.text).toBe("_{}");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns cursorOffset 0 when no keywords found", () => {
    const result = processTranscriptWithCursor("hello world", "en");
    expect(result.text).toBe("hello world");
    expect(result.cursorOffset).toBe(0);
  });

  it("works with Polish keywords", () => {
    const result = processTranscriptWithCursor("pierwiastek", "pl");
    expect(result.text).toBe("\\sqrt{}");
    expect(result.cursorOffset).toBe(0);
  });

  it("returns same text as processTranscript", () => {
    const inputs = ["alpha", "fraction", "parentheses", "hello world", "square root x"];
    for (const input of inputs) {
      const withCursor = processTranscriptWithCursor(input, "en");
      const without = processTranscript(input, "en");
      expect(withCursor.text).toBe(without);
    }
  });
});

describe("applyCorrections", () => {
  it("corrects 'pie' to 'pi' in English", () => {
    expect(applyCorrections("pie is a number", "en")).toBe("pi is a number");
  });

  it("corrects 'the green' to 'degree' in English", () => {
    expect(applyCorrections("the green of x", "en")).toBe("degree of x");
  });

  it("corrects 'route' to 'root' in English", () => {
    expect(applyCorrections("square route", "en")).toBe("square root");
  });

  it("corrects 'cosign' to 'cosine'", () => {
    expect(applyCorrections("cosign of theta", "en")).toBe("cosine of theta");
  });

  it("corrects number words to digits", () => {
    expect(applyCorrections("two plus three", "en")).toBe("2 plus 3");
    expect(applyCorrections("one hundred", "en")).toBe("1 hundred");
    expect(applyCorrections("zero", "en")).toBe("0");
  });

  it("is case-insensitive", () => {
    expect(applyCorrections("PIE", "en")).toBe("pi");
    expect(applyCorrections("The Green", "en")).toBe("degree");
  });

  it("corrects Polish number words", () => {
    expect(applyCorrections("dwa plus trzy", "pl")).toBe("2 plus 3");
  });
});

describe("splitByTrigger", () => {
  it("splits text by trigger and end-trigger", () => {
    const segments = splitByTrigger(
      "prose mathematics alpha close mathematics more",
      "mathematics",
      "close mathematics"
    );
    expect(segments).toEqual([
      { text: "prose ", isMath: false },
      { text: " alpha ", isMath: true },
      { text: " more", isMath: false },
    ]);
  });

  it("handles text with no trigger", () => {
    const segments = splitByTrigger("just prose", "mathematics", "close mathematics");
    expect(segments).toEqual([{ text: "just prose", isMath: false }]);
  });

  it("handles trigger without end trigger (math to end)", () => {
    const segments = splitByTrigger(
      "start mathematics alpha beta",
      "mathematics",
      "close mathematics"
    );
    expect(segments).toEqual([
      { text: "start ", isMath: false },
      { text: " alpha beta", isMath: true },
    ]);
  });

  it("handles multiple trigger zones", () => {
    const segments = splitByTrigger(
      "a mathematics x close mathematics b mathematics y close mathematics c",
      "mathematics",
      "close mathematics"
    );
    expect(segments).toEqual([
      { text: "a ", isMath: false },
      { text: " x ", isMath: true },
      { text: " b ", isMath: false },
      { text: " y ", isMath: true },
      { text: " c", isMath: false },
    ]);
  });
});
