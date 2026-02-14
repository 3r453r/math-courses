import { z } from "zod";

export const courseStructureSchema = z.object({
  title: z.string().describe("Course title"),
  description: z.string().describe("2-3 sentence course description"),
  suggestedLessonCount: z.number().min(3).max(30),
  contextDoc: z.string().describe(
    "A pedagogical guide document (500-1000 words, Markdown) covering: " +
    "1) Notation conventions used throughout the course, " +
    "2) Pedagogical approach and philosophy, " +
    "3) Key themes and connections between topics, " +
    "4) Difficulty calibration notes for content generation, " +
    "5) Style guidelines for explanations, proofs, and examples. " +
    "This document will be provided as context when generating each lesson."
  ),
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
      weight: z
        .number()
        .min(0.1)
        .max(5.0)
        .describe(
          "Relative importance weight for course completion scoring. " +
            "Capstone/synthesis lessons: 2.0-3.0. Standard lessons: 1.0. " +
            "Introductory/foundational: 0.5-1.0. Weights are normalized."
        ),
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
