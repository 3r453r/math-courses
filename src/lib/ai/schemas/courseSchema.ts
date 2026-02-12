import { z } from "zod";

export const courseStructureSchema = z.object({
  title: z.string().describe("Course title"),
  description: z.string().describe("2-3 sentence course description"),
  suggestedLessonCount: z.number().min(3).max(30),
  lessons: z.array(
    z.object({
      title: z.string(),
      summary: z
        .string()
        .describe("1-2 sentence summary of what this lesson covers"),
      orderIndex: z.number(),
      prerequisites: z
        .array(z.number())
        .describe("Array of orderIndex values this lesson depends on"),
      keyTopics: z.array(z.string()),
      estimatedDifficulty: z.enum([
        "introductory",
        "foundational",
        "intermediate",
        "advanced",
      ]),
    })
  ),
  edges: z.array(
    z.object({
      from: z.number().describe("orderIndex of prerequisite lesson"),
      to: z.number().describe("orderIndex of dependent lesson"),
      relationship: z.enum(["prerequisite", "recommended", "related"]),
    })
  ),
});

export type CourseStructureOutput = z.infer<typeof courseStructureSchema>;
