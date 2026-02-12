import { z } from "zod";

export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        questionText: z.string().describe("Markdown+LaTeX question text"),
        choices: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().describe("Markdown+LaTeX choice text"),
              correct: z.boolean(),
              explanation: z
                .string()
                .describe("Why this choice is correct/incorrect"),
            })
          )
          .min(4)
          .max(6),
        topic: z
          .string()
          .describe("The specific sub-topic this question tests"),
        difficulty: z.enum(["easy", "medium", "hard"]),
      })
    )
    .min(10)
    .max(20),
});

export type QuizOutput = z.infer<typeof quizSchema>;
