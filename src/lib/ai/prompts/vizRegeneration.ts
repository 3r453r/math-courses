export interface VizRegenerationParams {
  vizType: string;
  currentSpec: string;       // JSON string of broken spec
  caption: string;
  lessonTitle: string;
  lessonSummary: string;
  contextDoc: string;        // course-level pedagogical context
  surroundingSections: string; // 2 before + 2 after, text/math/theorem/definition only
  userFeedback?: string;
  hasScreenshot: boolean;
}

export function buildVizRegenerationPrompt(params: VizRegenerationParams): string {
  const {
    vizType,
    currentSpec,
    caption,
    lessonTitle,
    lessonSummary,
    contextDoc,
    surroundingSections,
    userFeedback,
    hasScreenshot,
  } = params;

  const specConstraints = getSpecConstraints(vizType);

  return `You are regenerating a single visualization for a math/science lesson. Your task is to produce an improved version of a "${vizType}" visualization.

## Current (broken) specification
\`\`\`json
${currentSpec}
\`\`\`

## What this visualization must illustrate
Caption: ${caption}

## Lesson context
Title: ${lessonTitle}
Summary: ${lessonSummary}

${contextDoc ? `## Course pedagogical context\n${contextDoc}\n` : ""}

${surroundingSections ? `## Surrounding lesson content (for mathematical context)\n${surroundingSections}\n` : ""}

## What's wrong / what to improve
${userFeedback || "Please improve the clarity and correctness of this visualization. Fix any overlapping labels, unreadable axes, or empty plots."}

${hasScreenshot ? "A screenshot of the broken visualization is attached — use it to understand the specific visual defects to fix.\n" : ""}

## Type-specific constraints for "${vizType}"
${specConstraints}

## Output requirements
Return a single improved visualization with:
- vizType: "${vizType}"
- spec: a valid JSON string following the constraints above
- caption: the same or improved caption text
- interactionHint: optional hint for user interaction (e.g. "Drag to rotate")

Make sure the spec produces a visually correct, readable, and pedagogically useful plot. Fix all known issues from the current spec.`;
}

function getSpecConstraints(vizType: string): string {
  switch (vizType) {
    case "function_plot":
      return `function_plot spec format: {"xRange":[min,max],"yRange":[min,max],"functions":[{"expression":"Math.pow(x,2)","color":"blue","label":"x²"}]}
- Expressions MUST use ONLY variable x (single-variable functions of x)
- Use JavaScript Math syntax: Math.sin, Math.cos, Math.pow, Math.exp, Math.log, Math.sqrt, Math.abs, Math.PI
- Choose xRange and yRange so the interesting part of the function is clearly visible
- Avoid functions with singularities inside xRange (e.g. Math.log(x) needs xRange starting above 0)
- Each function needs a distinct color and descriptive label
- yRange should be tighter than the full function range to avoid flat-looking plots`;

    case "vector_field":
      return `vector_field spec format option 1 (computed field): {"xRange":[min,max],"yRange":[min,max],"fieldFunction":"[dx_expr, dy_expr]"}
where dx_expr and dy_expr use variables x and y (JavaScript Math syntax).
Option 2 (explicit vectors): {"xRange":[min,max],"yRange":[min,max],"vectors":[{"origin":[x,y],"direction":[dx,dy],"color":"red"}]}
- fieldFunction expressions use x, y variables with JS Math syntax
- Keep the field magnitude reasonable to avoid arrow clutter
- Choose a grid density that makes the field pattern clear without overlap`;

    case "parametric_plot":
      return `parametric_plot spec format: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}
- Expressions use variables u and v with JavaScript Math syntax
- For 2D parametric curves, set zExpr to "0"
- Choose u/v ranges to complete the curve/surface without gaps or excessive overlap`;

    case "3d_surface":
      return `3d_surface spec format: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}
- Expressions use variables u and v with JavaScript Math syntax
- For z=f(x,y) surfaces, set xExpr="u", yExpr="v", zExpr="Math.sin(u)*Math.cos(v)"
- Choose u/v ranges to show the interesting topology without making the surface too cluttered`;

    case "geometry":
      return `geometry spec format: {"xRange":[min,max],"yRange":[min,max],"points":[{"x":0,"y":0,"label":"O","color":"red"}],"shapes":[{"type":"line","params":{"from":[-5,-5],"to":[5,5],"color":"blue"}},{"type":"circle","params":{"center":[0,0],"radius":2,"color":"green"}}],"vectors":[{"origin":[0,0],"direction":[2,1],"color":"red","label":"v"}]}
- For finite line segments, set "segment":true in params (lines extend infinitely by default)
- Keep labels short (1-3 chars) to avoid overlap
- Choose xRange/yRange so all geometric objects fit with some padding
- Use distinct colors for different geometric objects`;

    case "manifold":
      return `manifold spec format: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}
- Expressions use variables u and v with JavaScript Math syntax
- Choose expressions that create a topologically interesting surface for the lesson topic`;

    case "tangent_space":
      return `tangent_space spec format: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}
- The surface should clearly show the tangent plane at the point of interest
- Expressions use variables u and v with JavaScript Math syntax`;

    case "coordinate_transform":
      return `coordinate_transform spec format: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}
- Shows how coordinate systems transform — use expressions that illustrate the mapping
- Expressions use variables u and v with JavaScript Math syntax`;

    default:
      return `Produce a valid spec JSON string appropriate for vizType "${vizType}". Use JavaScript Math syntax for expressions.`;
  }
}
