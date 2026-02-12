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
          .min(4)
          .max(6),
        prerequisiteTopic: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
      })
    )
    .min(10)
    .max(20),
});

export type DiagnosticOutput = z.infer<typeof diagnosticSchema>;
