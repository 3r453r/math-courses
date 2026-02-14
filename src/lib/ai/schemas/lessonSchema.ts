import { z } from "zod";

export const lessonContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  sections: z.array(
    z.union([
      z.object({
        type: z.literal("text"),
        content: z.string().describe("Markdown with LaTeX ($...$ for inline, $$...$$ for display)"),
      }),
      z.object({
        type: z.literal("math"),
        latex: z.string().describe("Display LaTeX expression"),
        explanation: z.string().optional(),
      }),
      z.object({
        type: z.literal("definition"),
        term: z.string(),
        definition: z.string().describe("Markdown+LaTeX"),
        intuition: z.string().optional(),
      }),
      z.object({
        type: z.literal("theorem"),
        name: z.string(),
        statement: z.string().describe("Markdown+LaTeX"),
        proof: z.string().optional(),
        intuition: z.string().optional(),
      }),
      z.object({
        type: z.literal("visualization"),
        vizType: z.enum([
          "function_plot",
          "parametric_plot",
          "vector_field",
          "geometry",
          "3d_surface",
          "manifold",
          "tangent_space",
          "coordinate_transform",
        ]),
        spec: z.object({
          xRange: z.tuple([z.number(), z.number()]).optional(),
          yRange: z.tuple([z.number(), z.number()]).optional(),
          functions: z
            .array(
              z.object({
                expression: z.string().describe("JavaScript Math expression of x"),
                color: z.string().optional(),
                label: z.string().optional(),
              })
            )
            .optional(),
          parametricSurface: z
            .object({
              xExpr: z.string(),
              yExpr: z.string(),
              zExpr: z.string(),
              uRange: z.tuple([z.number(), z.number()]),
              vRange: z.tuple([z.number(), z.number()]),
            })
            .optional(),
          points: z
            .array(
              z.object({
                x: z.number(),
                y: z.number(),
                label: z.string().optional(),
              })
            )
            .optional(),
          vectors: z
            .array(
              z.object({
                origin: z.tuple([z.number(), z.number()]),
                direction: z.tuple([z.number(), z.number()]),
                color: z.string().optional(),
                label: z.string().optional(),
              })
            )
            .optional(),
        }),
        caption: z.string(),
        interactionHint: z.string().optional(),
      }),
      z.object({
        type: z.literal("code_block"),
        language: z.string().describe("Programming language (e.g., python, javascript, rust)"),
        code: z.string().describe("The code content"),
        explanation: z.string().optional().describe("Explanation of what the code does"),
      }),
    ])
  ),
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
