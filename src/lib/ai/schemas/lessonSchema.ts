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
  spec: z.object({
    xRange: z.array(z.number()).optional().describe("[min, max] x-axis range"),
    yRange: z.array(z.number()).optional().describe("[min, max] y-axis range"),
    functions: z.array(
      z.object({
        expression: z.string().describe("JavaScript Math expression of x"),
        color: z.string().optional(),
        label: z.string().optional(),
      })
    ).optional(),
    parametricSurface: z.object({
      xExpr: z.string(),
      yExpr: z.string(),
      zExpr: z.string(),
      uRange: z.array(z.number()).describe("[min, max] u parameter range"),
      vRange: z.array(z.number()).describe("[min, max] v parameter range"),
    }).optional(),
    points: z.array(
      z.object({
        x: z.number(),
        y: z.number(),
        label: z.string().optional(),
      })
    ).optional(),
    vectors: z.array(
      z.object({
        origin: z.array(z.number()).describe("[x, y] origin point"),
        direction: z.array(z.number()).describe("[dx, dy] direction vector"),
        color: z.string().optional(),
        label: z.string().optional(),
      })
    ).optional(),
  }).optional().describe("(visualization) Visualization specification"),
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
