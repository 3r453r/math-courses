import { z } from "zod";

/**
 * Schema for course-level translation output.
 * Used when translating course metadata (title, description, contextDoc).
 * Lesson and quiz translations reuse lessonContentSchema and quizSchema.
 */
export const courseTranslationSchema = z.object({
  title: z.string().describe("Translated course title"),
  description: z.string().describe("Translated course description"),
  contextDoc: z.string().describe("Translated pedagogical context document"),
});

export type CourseTranslationOutput = z.infer<typeof courseTranslationSchema>;
