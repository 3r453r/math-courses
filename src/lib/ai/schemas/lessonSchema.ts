import { z } from "zod";

// Flattened section schema — AI providers require a single object schema for
// array items (no unions/anyOf). The `type` enum discriminates which fields
// are relevant. Rendering uses separate types from src/types/lesson.ts.
const sectionSchema = z.object({
  type: z.enum(["text", "math", "definition", "theorem", "visualization", "code_block"]),
  // text
  content: z.string().optional().describe("(text) Markdown with LaTeX ($...$ for inline, $$...$$ for display)"),
  // math
  latex: z.string().optional().describe("(math) Display LaTeX expression"),
  // math | code_block
  explanation: z.string().optional().describe("(math) Why this expression matters; (code_block) what the code does"),
  // definition
  term: z.string().optional().describe("(definition) The term being defined"),
  definition: z.string().optional().describe("(definition) Markdown+LaTeX definition"),
  // definition | theorem
  intuition: z.string().optional().describe("(definition|theorem) Intuitive explanation"),
  // theorem
  name: z.string().optional().describe("(theorem) Theorem/lemma name"),
  statement: z.string().optional().describe("(theorem) Markdown+LaTeX statement"),
  proof: z.string().optional().describe("(theorem) Proof text"),
  // visualization
  vizType: z.enum([
    "function_plot", "parametric_plot", "vector_field", "geometry",
    "3d_surface", "manifold", "tangent_space", "coordinate_transform",
  ]).optional().describe("(visualization) Type of visualization"),
  spec: z.string().optional().describe(
    '(visualization) JSON string with visualization data. VIZTYPE SELECTION: function_plot for y=f(x) single-variable plots; vector_field for 2D fields F(x,y); 3d_surface for z=f(u,v) surfaces; geometry for points/lines/circles. ' +
    'function_plot: {"xRange":[min,max],"yRange":[min,max],"functions":[{"expression":"Math.pow(x,2)","color":"blue","label":"x²"}]}. Expressions must use ONLY variable x (single-variable functions). ' +
    'vector_field: {"xRange":[min,max],"yRange":[min,max],"fieldFunction":"[dx_expr, dy_expr]"} where dx_expr and dy_expr use variables x and y. Or explicit vectors: "vectors":[{"origin":[x,y],"direction":[dx,dy],"color":"red"}]. ' +
    'parametric_plot/3d_surface: {"parametricSurface":{"xExpr":"...","yExpr":"...","zExpr":"...","uRange":[min,max],"vRange":[min,max]}}. ' +
    'geometry: {"xRange":[min,max],"yRange":[min,max],"points":[{"x":0,"y":0,"label":"O","color":"red"}],"shapes":[{"type":"line","params":{"from":[-5,-5],"to":[5,5],"color":"blue"}},{"type":"circle","params":{"center":[0,0],"radius":2,"color":"green"}}],"vectors":[{"origin":[0,0],"direction":[2,1],"color":"red","label":"v"}]}. For shapes, set "segment":true in params for finite line segments; lines extend infinitely by default.'
  ),
  caption: z.string().optional().describe("(visualization) Caption text"),
  interactionHint: z.string().optional().describe("(visualization) Interaction hint"),
  // code_block
  language: z.string().optional().describe("(code_block) Programming language (e.g., python, javascript)"),
  code: z.string().optional().describe("(code_block) The code content"),
});

export const lessonContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  sections: z.array(sectionSchema),
  workedExamples: z.array(
    z.object({
      title: z.string(),
      problemStatement: z.string(),
      steps: z.array(
        z.object({
          description: z.string(),
          math: z.string().optional(),
        })
      ),
      finalAnswer: z.string(),
    })
  ),
  practiceExercises: z.array(
    z.object({
      id: z.string(),
      problemStatement: z.string(),
      hints: z.array(z.string()),
      solution: z.string(),
      answerType: z.enum(["free_response", "multiple_choice", "numeric"]),
      expectedAnswer: z.string().optional(),
      choices: z
        .array(
          z.object({
            label: z.string(),
            correct: z.boolean(),
          })
        )
        .optional(),
    })
  ),
  keyTakeaways: z.array(z.string()),
});

export type LessonContentOutput = z.infer<typeof lessonContentSchema>;
