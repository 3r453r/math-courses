import { parse, compile } from "mathjs";

/**
 * Creates a safe function from a JavaScript Math expression string.
 * The expression is parsed by mathjs, NOT eval'd.
 * Supports expressions like "sin(x)", "x^2 - 3*x + 1", etc.
 * Math.xxx prefixes are stripped automatically.
 */
export function createSafeFunction(expression: string): (x: number) => number {
  // Strip "Math." prefixes since mathjs uses bare function names
  const cleaned = expression.replace(/Math\./g, "");
  const node = parse(cleaned);
  const compiled = node.compile();
  return (x: number) => {
    const result = compiled.evaluate({ x });
    return typeof result === "number" ? result : NaN;
  };
}

/**
 * Creates a safe 2D vector field function from a JS expression string.
 * Expected format: "([x,y]) => [dx, dy]" - but we parse it safely.
 */
export function createSafeVectorField(
  dxExpression: string,
  dyExpression: string
): (x: number, y: number) => [number, number] {
  const dxCleaned = dxExpression.replace(/Math\./g, "");
  const dyCleaned = dyExpression.replace(/Math\./g, "");
  const dxCompiled = compile(dxCleaned);
  const dyCompiled = compile(dyCleaned);
  return (x: number, y: number) => {
    const dx = dxCompiled.evaluate({ x, y });
    const dy = dyCompiled.evaluate({ x, y });
    return [
      typeof dx === "number" ? dx : 0,
      typeof dy === "number" ? dy : 0,
    ];
  };
}

/**
 * Creates a safe parametric surface function for 3D visualizations.
 */
export function createSafeParametricSurface(
  xExpr: string,
  yExpr: string,
  zExpr: string
): (u: number, v: number) => [number, number, number] {
  const xCompiled = compile(xExpr.replace(/Math\./g, ""));
  const yCompiled = compile(yExpr.replace(/Math\./g, ""));
  const zCompiled = compile(zExpr.replace(/Math\./g, ""));
  return (u: number, v: number) => {
    const scope = { u, v, pi: Math.PI, e: Math.E };
    return [
      xCompiled.evaluate(scope) as number,
      yCompiled.evaluate(scope) as number,
      zCompiled.evaluate(scope) as number,
    ];
  };
}
