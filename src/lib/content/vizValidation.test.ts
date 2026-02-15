import { describe, it, expect } from "vitest";
import { validateAndRepairVisualizations } from "./vizValidation";

describe("validateAndRepairVisualizations", () => {
  it("passes through non-visualization sections unchanged", () => {
    const sections = [
      { type: "text", content: "Hello world" },
      { type: "math", latex: "x^2" },
      { type: "definition", term: "Gradient", definition: "..." },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toEqual(sections);
    expect(warnings).toHaveLength(0);
  });

  it("keeps valid function_plot with single-variable expression", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "function_plot",
        spec: {
          xRange: [-5, 5],
          yRange: [-5, 5],
          functions: [{ expression: "Math.pow(x,2)", color: "blue" }],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("removes function_plot using y variable", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "function_plot",
        spec: {
          functions: [
            { expression: "Math.pow(x,2)+Math.pow(y,2)", color: "blue" },
          ],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("function_plot");
  });

  it("removes function_plot with unparseable expression", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "function_plot",
        spec: {
          functions: [{ expression: "@@@invalid" }],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("keeps valid vector_field with fieldFunction", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "vector_field",
        spec: {
          xRange: [-3, 3],
          yRange: [-3, 3],
          fieldFunction: "[2*x, 2*y]",
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("removes vector_field with invalid fieldFunction", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "vector_field",
        spec: {
          fieldFunction: "[@@@, bad]",
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("vector_field");
  });

  it("removes vector_field with unparseable fieldFunction format", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "vector_field",
        spec: {
          fieldFunction: "not a bracket expression",
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("keeps vector_field with valid explicit vectors", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "vector_field",
        spec: {
          vectors: [
            { origin: [0, 0], direction: [1, 1] },
            { origin: [1, 0], direction: [0, 1] },
          ],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("removes vector_field with malformed explicit vectors", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "vector_field",
        spec: {
          vectors: [
            { origin: [0], direction: [1, 1] }, // origin has wrong length
          ],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("keeps valid 3d_surface with parametric surface", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "3d_surface",
        spec: {
          parametricSurface: {
            xExpr: "u",
            yExpr: "v",
            zExpr: "u + v",
            uRange: [0, 1],
            vRange: [0, 1],
          },
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("removes 3d_surface with invalid parametric expressions", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "3d_surface",
        spec: {
          parametricSurface: {
            xExpr: "u",
            yExpr: "v",
            zExpr: "@@@invalid",
            uRange: [0, 1],
            vRange: [0, 1],
          },
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("3d_surface");
  });

  it("removes parametric_plot with invalid expressions", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "parametric_plot",
        spec: {
          parametricSurface: {
            xExpr: "bad(u",
            yExpr: "v",
            zExpr: "u",
          },
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("parametric_plot");
  });

  it("preserves mixed sections, only removes bad visualizations", () => {
    const sections = [
      { type: "text", content: "Introduction" },
      {
        type: "visualization",
        vizType: "function_plot",
        spec: { functions: [{ expression: "x^2" }] },
      },
      { type: "math", latex: "\\nabla f" },
      {
        type: "visualization",
        vizType: "function_plot",
        spec: { functions: [{ expression: "x + y" }] }, // uses y — invalid
      },
      { type: "text", content: "Conclusion" },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(4); // 3 non-viz + 1 valid viz
    expect(result[0]).toEqual({ type: "text", content: "Introduction" });
    expect(result[1].vizType).toBe("function_plot");
    expect(result[2]).toEqual({ type: "math", latex: "\\nabla f" });
    expect(result[3]).toEqual({ type: "text", content: "Conclusion" });
    expect(warnings).toHaveLength(1);
  });

  it("keeps geometry vizType without validation (no expressions)", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "geometry",
        spec: {
          points: [{ x: 0, y: 0, label: "O" }],
          shapes: [{ type: "circle", params: { center: [0, 0], radius: 1 } }],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("keeps visualization with no spec", () => {
    const sections = [
      { type: "visualization", vizType: "function_plot" },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("keeps function_plot with trig expressions", () => {
    const sections = [
      {
        type: "visualization",
        vizType: "function_plot",
        spec: {
          functions: [
            { expression: "Math.sin(x)" },
            { expression: "Math.cos(x) + 1" },
          ],
        },
      },
    ];
    const { sections: result, warnings } =
      validateAndRepairVisualizations(sections);
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });
});
