import { describe, it, expect } from "vitest";
import { processTranscript } from "./voiceKeywords";

describe("processTranscript", () => {
  describe("English keywords", () => {
    it("replaces mathematics open/close with dollar signs", () => {
      expect(processTranscript("mathematics open x mathematics close", "en")).toBe("$ x $");
    });

    it("replaces superscript keyword", () => {
      expect(processTranscript("x superscript 2", "en")).toBe("x ^{} 2");
    });

    it("converts a full spoken equation", () => {
      const input = "mathematics open x superscript 2 mathematics close";
      const result = processTranscript(input, "en");
      expect(result).toBe("$ x ^{} 2 $");
    });

    it("replaces display math delimiters", () => {
      const input = "display mathematics open x display mathematics close";
      const result = processTranscript(input, "en");
      expect(result).toContain("$$");
      expect(result).toContain("x");
    });

    it("replaces fraction keyword", () => {
      expect(processTranscript("fraction", "en")).toBe("\\frac{}{}");
    });

    it("replaces square root keyword", () => {
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

    it("replaces formatting/accent keywords", () => {
      expect(processTranscript("vector", "en")).toBe("\\vec{}");
      expect(processTranscript("hat accent", "en")).toBe("\\hat{}");
      expect(processTranscript("overline", "en")).toBe("\\overline{}");
      expect(processTranscript("text mode", "en")).toBe("\\text{}");
    });

    it("replaces delimiter keywords", () => {
      expect(processTranscript("parentheses", "en")).toBe("\\left( \\right)");
      expect(processTranscript("absolute value", "en")).toBe("\\left| \\right|");
    });
  });

  describe("Polish keywords", () => {
    it("replaces Polish math delimiters", () => {
      expect(processTranscript("matematyka otwórz x matematyka zamknij", "pl")).toBe("$ x $");
    });

    it("replaces Polish superscript", () => {
      expect(processTranscript("indeks górny", "pl")).toBe("^{}");
    });

    it("replaces Polish subscript", () => {
      expect(processTranscript("indeks dolny", "pl")).toBe("_{}");
    });

    it("replaces Polish fraction", () => {
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
      const input = "summation i next input n end input";
      expect(processTranscript(input, "en")).toBe("\\sum_{i}^{n}");
    });

    it("processes simple keywords inside input slots", () => {
      const input = "summation alpha next input beta end input";
      expect(processTranscript(input, "en")).toBe("\\sum_{\\alpha}^{\\beta}");
    });

    it("fills fraction template", () => {
      const input = "fraction of a next input b end input";
      expect(processTranscript(input, "en")).toBe("\\frac{a}{b}");
    });

    it("fills single-input template (limit)", () => {
      const input = "limit of x end input";
      expect(processTranscript(input, "en")).toBe("\\lim_{x}");
    });

    it("fills integral from template", () => {
      const input = "integral from 0 next input infinity end input";
      expect(processTranscript(input, "en")).toBe("\\int_{0}^{\\infty}");
    });

    it("fills product template", () => {
      const input = "product over k next input n end input";
      expect(processTranscript(input, "en")).toBe("\\prod_{k}^{n}");
    });

    it("inserts empty template when no markers follow", () => {
      expect(processTranscript("summation", "en")).toBe("\\sum_{}^{}");
    });

    it("leaves second slot empty when only end input is used", () => {
      const input = "summation i end input";
      expect(processTranscript(input, "en")).toBe("\\sum_{i}^{}");
    });

    it("preserves surrounding text", () => {
      const input = "the summation i next input n end input is finite";
      expect(processTranscript(input, "en")).toBe(
        "the \\sum_{i}^{n} is finite"
      );
    });

    it("handles case-insensitive multi-input keywords", () => {
      const input = "Summation I Next Input N End Input";
      expect(processTranscript(input, "en")).toBe("\\sum_{I}^{N}");
    });

    it("does not double-process keywords in template output", () => {
      // "pi" is a simple keyword. After filling the slot with processed "pi" → "\pi",
      // the simple keyword pass should NOT match "\pi" again.
      const input = "summation pi next input 1 end input";
      const result = processTranscript(input, "en");
      expect(result).toBe("\\sum_{\\pi}^{1}");
      // Should NOT contain "\\\\pi" (double backslash)
      expect(result).not.toContain("\\\\");
    });

    describe("Polish multi-input", () => {
      it("fills summation template in Polish", () => {
        const input = "sumowanie alfa następne pole n koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\sum_{\\alpha}^{n}");
      });

      it("fills fraction template in Polish", () => {
        const input = "ułamek z a następne pole b koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\frac{a}{b}");
      });

      it("fills limit template in Polish", () => {
        const input = "granica x koniec pola";
        expect(processTranscript(input, "pl")).toBe("\\lim_{x}");
      });

      it("inserts empty template in Polish when no markers", () => {
        expect(processTranscript("sumowanie", "pl")).toBe("\\sum_{}^{}");
      });
    });
  });
});
