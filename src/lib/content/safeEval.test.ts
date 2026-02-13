import { describe, it, expect } from "vitest";
import {
  createSafeFunction,
  createSafeVectorField,
  createSafeParametricSurface,
} from "./safeEval";

describe("createSafeFunction", () => {
  it("evaluates x^2 correctly", () => {
    const fn = createSafeFunction("x^2");
    expect(fn(3)).toBe(9);
    expect(fn(0)).toBe(0);
    expect(fn(-2)).toBe(4);
  });

  it("evaluates sin(x) at PI/2", () => {
    const fn = createSafeFunction("sin(x)");
    expect(fn(Math.PI / 2)).toBeCloseTo(1, 10);
  });

  it("evaluates cos(x) at PI", () => {
    const fn = createSafeFunction("cos(x)");
    expect(fn(Math.PI)).toBeCloseTo(-1, 10);
  });

  it("strips Math. prefix and evaluates", () => {
    const fn = createSafeFunction("Math.sin(x)");
    expect(fn(Math.PI / 2)).toBeCloseTo(1, 10);
  });

  it("evaluates compound expression: x^2 - 3*x + 1", () => {
    const fn = createSafeFunction("x^2 - 3*x + 1");
    // At x=2: 4 - 6 + 1 = -1
    expect(fn(2)).toBe(-1);
  });

  it("evaluates sqrt(x)", () => {
    const fn = createSafeFunction("sqrt(x)");
    expect(fn(9)).toBe(3);
    expect(fn(0)).toBe(0);
  });

  it("evaluates exp(x)", () => {
    const fn = createSafeFunction("exp(x)");
    expect(fn(0)).toBe(1);
    expect(fn(1)).toBeCloseTo(Math.E, 10);
  });

  it("evaluates abs(x)", () => {
    const fn = createSafeFunction("abs(x)");
    expect(fn(-5)).toBe(5);
    expect(fn(5)).toBe(5);
  });

  it("returns NaN for invalid expression at runtime", () => {
    const fn = createSafeFunction("sqrt(x)");
    expect(fn(-1)).toBeNaN();
  });

  it("throws on unparseable expression", () => {
    expect(() => createSafeFunction("@@@")).toThrow();
  });

  it("handles division", () => {
    const fn = createSafeFunction("1/x");
    expect(fn(2)).toBe(0.5);
    expect(fn(0)).toBe(Infinity);
  });
});

describe("createSafeVectorField", () => {
  it("evaluates a simple rotation field: (-y, x)", () => {
    const field = createSafeVectorField("-y", "x");
    const [dx, dy] = field(3, 4);
    expect(dx).toBe(-4);
    expect(dy).toBe(3);
  });

  it("evaluates field with both variables: (x+y, x-y)", () => {
    const field = createSafeVectorField("x+y", "x-y");
    const [dx, dy] = field(2, 3);
    expect(dx).toBe(5);
    expect(dy).toBe(-1);
  });

  it("evaluates constant field", () => {
    const field = createSafeVectorField("1", "0");
    const [dx, dy] = field(10, 20);
    expect(dx).toBe(1);
    expect(dy).toBe(0);
  });

  it("evaluates field with trig functions", () => {
    const field = createSafeVectorField("sin(x)", "cos(y)");
    const [dx, dy] = field(0, 0);
    expect(dx).toBeCloseTo(0, 10);
    expect(dy).toBeCloseTo(1, 10);
  });

  it("strips Math. prefix", () => {
    const field = createSafeVectorField("Math.sin(x)", "Math.cos(y)");
    const [dx, dy] = field(Math.PI / 2, 0);
    expect(dx).toBeCloseTo(1, 10);
    expect(dy).toBeCloseTo(1, 10);
  });
});

describe("createSafeParametricSurface", () => {
  it("evaluates basic parametric surface", () => {
    const surf = createSafeParametricSurface("u", "v", "u + v");
    const [x, y, z] = surf(2, 3);
    expect(x).toBe(2);
    expect(y).toBe(3);
    expect(z).toBe(5);
  });

  it("has pi and e in scope", () => {
    const surf = createSafeParametricSurface("pi", "e", "pi + e");
    const [x, y, z] = surf(0, 0);
    expect(x).toBeCloseTo(Math.PI, 10);
    expect(y).toBeCloseTo(Math.E, 10);
    expect(z).toBeCloseTo(Math.PI + Math.E, 10);
  });

  it("evaluates trig parametric surface", () => {
    const surf = createSafeParametricSurface(
      "cos(u) * cos(v)",
      "cos(u) * sin(v)",
      "sin(u)"
    );
    // At u=0, v=0: cos(0)*cos(0)=1, cos(0)*sin(0)=0, sin(0)=0
    const [x, y, z] = surf(0, 0);
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it("uses u and v parameters correctly", () => {
    const surf = createSafeParametricSurface("u^2", "v^2", "u*v");
    const [x, y, z] = surf(3, 4);
    expect(x).toBe(9);
    expect(y).toBe(16);
    expect(z).toBe(12);
  });
});
