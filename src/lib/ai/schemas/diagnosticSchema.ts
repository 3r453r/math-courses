import { z } from "zod";

export const diagnosticSchema = z.object({
  prerequisites: z.array(
    z.object({
      topic: z.string(),
      importance: z.enum(["essential", "helpful", "optional"]),
      description: z.string(),
    })
  ),
  questions: z
    .array(
      z.object({
        id: z.string(),
        questionText: z.string(),
        choices: z
          .array(
            z.object({
              id: z.string(),
              text: z.string(),
              correct: z.boolean(),
              explanation: z.string(),
            })
          )
          .describe("4-6 answer choices"),
        prerequisiteTopic: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
      })
    )
    .describe("10-20 diagnostic questions"),
});

export type DiagnosticOutput = z.infer<typeof diagnosticSchema>;
