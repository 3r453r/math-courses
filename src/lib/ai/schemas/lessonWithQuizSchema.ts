import { z } from "zod";
import { lessonContentSchema } from "./lessonSchema";
import { quizSchema } from "./quizSchema";

export const lessonWithQuizSchema = z.object({
  lesson: lessonContentSchema,
  quiz: quizSchema.describe(
    "Quiz questions that directly test understanding of the lesson content above. " +
    "Reference specific definitions, theorems, and examples from the lesson."
  ),
});

export type LessonWithQuizOutput = z.infer<typeof lessonWithQuizSchema>;
