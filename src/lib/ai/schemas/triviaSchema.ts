import { z } from "zod";

export const triviaSchema = z.object({
  slides: z.array(
    z.object({
      title: z.string().describe("Short catchy title for the trivia slide"),
      fact: z
        .string()
        .describe(
          "2-4 sentences about a fun fact, historical anecdote, or surprising connection. Markdown + LaTeX OK."
        ),
      funRating: z.enum(["mind-blowing", "cool", "neat"]),
    })
  ),
});

export type TriviaOutput = z.infer<typeof triviaSchema>;
