import { z } from "zod";

export const courseSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().describe("Creative course title"),
        description: z
          .string()
          .describe("2-3 sentence course description"),
        topic: z.string().describe("Main topic for course creation"),
        rationale: z
          .string()
          .describe(
            "Why this course is interesting given the user's existing courses"
          ),
        connectedCourses: z
          .array(z.string())
          .describe("Titles of existing courses this draws from"),
        focusAreas: z
          .array(z.string())
          .min(3)
          .max(5)
          .describe("Suggested focus areas for the course"),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        estimatedLessons: z
          .number()
          .int()
          .min(5)
          .max(20)
          .describe("Suggested number of lessons"),
      })
    )
    .min(1)
    .max(3),
});

export type CourseSuggestionOutput = z.infer<typeof courseSuggestionSchema>;
