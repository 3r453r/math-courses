import { z } from "zod";

export const completionSummarySchema = z.object({
  narrative: z.string().describe(
    "A 200-400 word narrative summary of the student's learning journey. " +
    "Highlight strengths, areas of growth, topics that required extra study, " +
    "and overall achievement. Use an encouraging, constructive tone. " +
    "Reference specific lessons and topics. Use Markdown formatting."
  ),
  recommendation: z.object({
    type: z.enum(["deeper", "broader", "weakness-focused", "advanced"]).describe(
      "Type of follow-up: 'deeper' = same topic more depth, " +
      "'broader' = related topic, 'weakness-focused' = retarget weak areas, " +
      "'advanced' = next difficulty level"
    ),
    suggestedTopic: z.string().describe("Recommended topic for the next course"),
    suggestedDescription: z.string().describe("2-3 sentence description for the recommended course"),
    suggestedDifficulty: z.enum(["beginner", "intermediate", "advanced"]),
    suggestedFocusAreas: z.array(z.string()).min(3).max(5).describe(
      "3-5 focus areas for the recommended course"
    ),
    rationale: z.string().describe(
      "1-2 sentence explanation of why this follow-up is recommended"
    ),
  }),
});

export type CompletionSummaryOutput = z.infer<typeof completionSummarySchema>;
