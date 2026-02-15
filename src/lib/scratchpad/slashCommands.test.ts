import { describe, it, expect } from "vitest";
import {
  getCommandByTrigger,
  getCommandsByCategory,
  filterCommandsByPrefix,
  SLASH_COMMANDS,
} from "./slashCommands";

describe("getCommandByTrigger", () => {
  it('returns the fraction command for "frac"', () => {
    const cmd = getCommandByTrigger("frac");
    expect(cmd).toBeDefined();
    expect(cmd!.trigger).toBe("frac");
    expect(cmd!.expansion).toBe("\\frac{}{}");
    expect(cmd!.category).toBe("formatting");
  });

  it('returns the integral command for "int"', () => {
    const cmd = getCommandByTrigger("int");
    expect(cmd).toBeDefined();
    expect(cmd!.expansion).toBe("\\int_{}^{}");
  });

  it('returns the alpha command for "alpha"', () => {
    const cmd = getCommandByTrigger("alpha");
    expect(cmd).toBeDefined();
    expect(cmd!.expansion).toBe("\\alpha");
    expect(cmd!.category).toBe("greek");
  });

  it("returns undefined for nonexistent trigger", () => {
    expect(getCommandByTrigger("nonexistent")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getCommandByTrigger("")).toBeUndefined();
  });

  it('returns superscript for "u"', () => {
    const cmd = getCommandByTrigger("u");
    expect(cmd).toBeDefined();
    expect(cmd!.expansion).toBe("^{}");
  });

  it('returns subscript for "d"', () => {
    const cmd = getCommandByTrigger("d");
    expect(cmd).toBeDefined();
    expect(cmd!.expansion).toBe("_{}");
  });
});

describe("filterCommandsByPrefix", () => {
  it("returns all commands up to limit for empty query", () => {
    const results = filterCommandsByPrefix("");
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns many commands for empty query with large limit", () => {
    const results = filterCommandsByPrefix("", 100);
    // Empty query returns a diverse sample (perCategory from each group), not necessarily all
    expect(results.length).toBeGreaterThanOrEqual(SLASH_COMMANDS.length * 0.5);
    expect(results.length).toBeLessThanOrEqual(SLASH_COMMANDS.length);
  });

  it('matches "su" prefix — includes sum variants and subset', () => {
    const results = filterCommandsByPrefix("su", 20);
    const triggers = results.map((c) => c.trigger);
    expect(triggers).toContain("sum");
    expect(triggers).toContain("sum-1-inf");
    expect(triggers).toContain("sum-1-n");
    expect(triggers).toContain("subset");
  });

  it('does not include unrelated commands for "su"', () => {
    const results = filterCommandsByPrefix("su", 20);
    const triggers = results.map((c) => c.trigger);
    expect(triggers).not.toContain("frac");
    expect(triggers).not.toContain("alpha");
  });

  it("respects limit parameter", () => {
    const results = filterCommandsByPrefix("", 3);
    expect(results.length).toBe(3);
  });

  it("returns empty array for no matches", () => {
    const results = filterCommandsByPrefix("zzzzz");
    expect(results).toHaveLength(0);
  });

  it('matches case-insensitively (triggers are lowercase anyway)', () => {
    // "Gamma" is an actual trigger (uppercase G)
    const results = filterCommandsByPrefix("gamma", 20);
    const triggers = results.map((c) => c.trigger);
    expect(triggers).toContain("gamma");
    expect(triggers).toContain("Gamma");
  });
});

describe("getCommandsByCategory", () => {
  it("returns 5 categories", () => {
    const categories = getCommandsByCategory();
    const keys = Object.keys(categories);
    expect(keys).toContain("formatting");
    expect(keys).toContain("operators");
    expect(keys).toContain("greek");
    expect(keys).toContain("symbols");
    expect(keys).toContain("delimiters");
    expect(keys).toHaveLength(5);
  });

  it("all commands are assigned to a category", () => {
    const categories = getCommandsByCategory();
    const total = Object.values(categories).reduce(
      (sum, cmds) => sum + cmds.length,
      0
    );
    expect(total).toBe(SLASH_COMMANDS.length);
  });

  it("each command in a category has the correct category field", () => {
    const categories = getCommandsByCategory();
    for (const [category, commands] of Object.entries(categories)) {
      for (const cmd of commands) {
        expect(cmd.category).toBe(category);
      }
    }
  });
});
