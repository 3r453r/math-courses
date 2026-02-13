import { describe, it, expect } from "vitest";
import { detectPendingSlash, tryExpandSlashCommand } from "./expandSlashCommand";

describe("detectPendingSlash", () => {
  it("detects /frac at cursor", () => {
    const text = "hello /frac";
    const result = detectPendingSlash(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.slashIndex).toBe(6);
    expect(result!.query).toBe("frac");
  });

  it("detects /sum in middle of text", () => {
    const text = "some text /sum more text";
    const cursor = 14; // right after "sum"
    const result = detectPendingSlash(text, cursor);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("sum");
  });

  it("returns null when no slash present", () => {
    const text = "hello world";
    const result = detectPendingSlash(text, text.length);
    expect(result).toBeNull();
  });

  it("returns null when slash is followed by space before cursor", () => {
    const text = "hello / frac";
    const result = detectPendingSlash(text, text.length);
    // cursor scans back from end, hits space, stops — no slash found
    expect(result).toBeNull();
  });

  it("detects slash at start of text", () => {
    const text = "/alpha";
    const result = detectPendingSlash(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.slashIndex).toBe(0);
    expect(result!.query).toBe("alpha");
  });

  it("returns empty query for bare slash", () => {
    const text = "text /";
    const result = detectPendingSlash(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("");
  });

  it("stops at newline boundary", () => {
    const text = "line1\n/frac";
    const result = detectPendingSlash(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("frac");
  });
});

describe("tryExpandSlashCommand", () => {
  it("expands /frac to \\frac{}{} with correct cursor", () => {
    const text = "hello /frac";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("hello \\frac{}{}");
    // cursorOffset is 4 (from end), so cursor at length - 4
    const expectedCursor = "hello \\frac{}{}".length - 4;
    expect(result!.newCursorPosition).toBe(expectedCursor);
  });

  it("expands /alpha to \\alpha", () => {
    const text = "/alpha";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("\\alpha");
    // cursorOffset is 0, so cursor at end
    expect(result!.newCursorPosition).toBe("\\alpha".length);
  });

  it("preserves surrounding text", () => {
    const text = "before /sqrt after";
    const cursor = 12; // right after "sqrt" — "before /sqrt"
    const result = tryExpandSlashCommand(text, cursor);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("before \\sqrt{} after");
  });

  it("returns null for unknown commands", () => {
    const text = "/unknown";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).toBeNull();
  });

  it("returns null when no slash present", () => {
    const text = "just text";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).toBeNull();
  });

  it("returns null for bare slash", () => {
    const text = "/";
    const result = tryExpandSlashCommand(text, text.length);
    // query is empty, so no command match
    expect(result).toBeNull();
  });

  it("expands /sum correctly", () => {
    const text = "\\(\\) /sum";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("\\(\\) \\sum_{}^{}");
  });

  it("expands /matrix with multiline expansion", () => {
    const text = "/matrix";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toContain("\\begin{pmatrix}");
    expect(result!.newText).toContain("\\end{pmatrix}");
  });

  it("handles superscript shorthand /u", () => {
    const text = "x/u";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("x^{}");
  });

  it("handles subscript shorthand /d", () => {
    const text = "x/d";
    const result = tryExpandSlashCommand(text, text.length);
    expect(result).not.toBeNull();
    expect(result!.newText).toBe("x_{}");
  });
});
