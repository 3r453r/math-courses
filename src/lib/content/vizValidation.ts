import {
  createSafeFunction,
  createSafeVectorField,
  createSafeParametricSurface,
} from "./safeEval";

interface SectionLike {
  type: string;
  vizType?: string;
  spec?: unknown;
}

interface ValidationResult {
  sections: SectionLike[];
  warnings: string[];
}

/**
 * Validates visualization sections in lesson content.
 * Removes malformed visualizations that would crash at render time.
 * Returns the cleaned sections array and any warnings generated.
 */
export function validateAndRepairVisualizations(
  sections: SectionLike[]
): ValidationResult {
  const warnings: string[] = [];
  const result: SectionLike[] = [];

  for (const section of sections) {
    if (section.type !== "visualization") {
      result.push(section);
      continue;
    }

    const spec = section.spec as Record<string, unknown> | undefined;
    if (!spec) {
      result.push(section);
      continue;
    }

    switch (section.vizType) {
      case "function_plot": {
        if (validateFunctionPlot(spec)) {
          result.push(section);
        } else {
          warnings.push(
            "Removed malformed function_plot visualization (expression used unsupported variables or failed to evaluate)"
          );
        }
        break;
      }
      case "vector_field": {
        if (validateVectorField(spec)) {
          result.push(section);
        } else {
          warnings.push(
            "Removed malformed vector_field visualization (field function or vectors failed to evaluate)"
          );
        }
        break;
      }
      case "3d_surface":
      case "parametric_plot": {
        if (validateParametricSurface(spec)) {
          result.push(section);
        } else {
          warnings.push(
            `Removed malformed ${section.vizType} visualization (parametric expressions failed to evaluate)`
          );
        }
        break;
      }
      default: {
        // geometry, manifold, etc. — no expression evaluation, keep as-is
        result.push(section);
        break;
      }
    }
  }

  return { sections: result, warnings };
}

function validateFunctionPlot(spec: Record<string, unknown>): boolean {
  const functions = spec.functions as
    | Array<{ expression?: string }>
    | undefined;
  if (!Array.isArray(functions) || functions.length === 0) return true; // no functions to validate

  for (const f of functions) {
    if (!f.expression) continue;
    try {
      const fn = createSafeFunction(f.expression);
      fn(0); // test-evaluate at x=0
    } catch {
      return false;
    }
  }
  return true;
}

function validateVectorField(spec: Record<string, unknown>): boolean {
  // Check fieldFunction format: "[dx_expr, dy_expr]"
  if (spec.fieldFunction && typeof spec.fieldFunction === "string") {
    const match = (spec.fieldFunction as string).match(
      /\[([^,\]]+),\s*([^\]]+)\]/
    );
    if (match) {
      try {
        const vf = createSafeVectorField(match[1].trim(), match[2].trim());
        vf(0, 0); // test-evaluate at origin
      } catch {
        return false;
      }
    } else {
      // fieldFunction present but unparseable
      return false;
    }
  }

  // Check explicit vectors
  const vectors = spec.vectors as
    | Array<{ origin?: unknown; direction?: unknown }>
    | undefined;
  if (Array.isArray(vectors)) {
    for (const v of vectors) {
      if (!isNumericArray(v.origin, 2) || !isNumericArray(v.direction, 2)) {
        return false;
      }
    }
  }

  return true;
}

function validateParametricSurface(spec: Record<string, unknown>): boolean {
  const ps = spec.parametricSurface as
    | { xExpr?: string; yExpr?: string; zExpr?: string }
    | undefined;
  if (!ps) return true; // no parametric data to validate

  if (!ps.xExpr || !ps.yExpr || !ps.zExpr) return true; // incomplete but not crashable

  try {
    const fn = createSafeParametricSurface(ps.xExpr, ps.yExpr, ps.zExpr);
    fn(0, 0); // test-evaluate at (0,0)
  } catch {
    return false;
  }
  return true;
}

function isNumericArray(val: unknown, length: number): boolean {
  return (
    Array.isArray(val) &&
    val.length === length &&
    val.every((v) => typeof v === "number" && isFinite(v))
  );
}
