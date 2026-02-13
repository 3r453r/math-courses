import { describe, it, expect } from "vitest";
import { courseStructureSchema } from "./courseSchema";
import { mockCourseStructure } from "../mockData";

describe("courseStructureSchema", () => {
  it("validates mock course structure data", () => {
    const data = mockCourseStructure();
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const data = mockCourseStructure();
    const { title, ...rest } = data;
    const result = courseStructureSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing lessons array", () => {
    const data = mockCourseStructure();
    const { lessons, ...rest } = data;
    const result = courseStructureSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects suggestedLessonCount below 3", () => {
    const data = { ...mockCourseStructure(), suggestedLessonCount: 1 };
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects suggestedLessonCount above 30", () => {
    const data = { ...mockCourseStructure(), suggestedLessonCount: 50 };
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid estimatedDifficulty enum", () => {
    const data = mockCourseStructure();
    data.lessons[0].estimatedDifficulty = "expert" as never;
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid edge relationship", () => {
    const data = {
      ...mockCourseStructure(),
      edges: [{ from: 0, to: 1, relationship: "invalid" }],
    };
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("accepts valid edge relationships", () => {
    const data = {
      ...mockCourseStructure(),
      edges: [
        { from: 0, to: 1, relationship: "prerequisite" },
        { from: 0, to: 1, relationship: "recommended" },
        { from: 0, to: 1, relationship: "related" },
      ],
    };
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates lesson structure fields", () => {
    const data = mockCourseStructure();
    // Should have required fields
    for (const lesson of data.lessons) {
      expect(lesson).toHaveProperty("title");
      expect(lesson).toHaveProperty("summary");
      expect(lesson).toHaveProperty("orderIndex");
      expect(lesson).toHaveProperty("prerequisites");
      expect(lesson).toHaveProperty("keyTopics");
      expect(lesson).toHaveProperty("estimatedDifficulty");
    }
  });
});
