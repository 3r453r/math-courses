import { describe, it, expect } from "vitest";
import { buildCourseStructurePrompt } from "./courseStructure";
import { buildQuizPrompt, buildDiagnosticPrompt } from "./quizGeneration";

describe("buildCourseStructurePrompt", () => {
  const baseParams = {
    topic: "Linear Algebra",
    description: "Introductory course",
    focusAreas: ["Vectors", "Matrices"],
    difficulty: "intermediate",
  };

  it("does not include language instruction without language param", () => {
    const result = buildCourseStructurePrompt(baseParams);
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it("does not include language instruction with language 'en'", () => {
    const result = buildCourseStructurePrompt({ ...baseParams, language: "en" });
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it('includes Polish language instruction with language "pl"', () => {
    const result = buildCourseStructurePrompt({ ...baseParams, language: "pl" });
    expect(result).toContain("LANGUAGE REQUIREMENT");
    expect(result).toContain("Polish");
  });

  it("includes the topic in the prompt", () => {
    const result = buildCourseStructurePrompt(baseParams);
    expect(result).toContain("Linear Algebra");
  });

  it("includes focus areas joined by comma", () => {
    const result = buildCourseStructurePrompt(baseParams);
    expect(result).toContain("Vectors, Matrices");
  });

  it("includes lesson count when provided", () => {
    const result = buildCourseStructurePrompt({ ...baseParams, lessonCount: 12 });
    expect(result).toContain("TARGET LESSON COUNT: 12");
  });

  it("suggests optimal number when lessonCount is omitted", () => {
    const result = buildCourseStructurePrompt(baseParams);
    expect(result).toContain("Suggest the optimal number");
  });
});

describe("buildQuizPrompt", () => {
  const baseParams = {
    lessonTitle: "Matrix Multiplication",
    lessonSummary: "How to multiply matrices",
    courseTopic: "Linear Algebra",
    difficulty: "intermediate",
  };

  it("does not include language instruction without language param", () => {
    const result = buildQuizPrompt(baseParams);
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it("does not include language instruction with language 'en'", () => {
    const result = buildQuizPrompt({ ...baseParams, language: "en" });
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it('includes Polish language instruction with language "pl"', () => {
    const result = buildQuizPrompt({ ...baseParams, language: "pl" });
    expect(result).toContain("LANGUAGE REQUIREMENT");
    expect(result).toContain("Polish");
  });

  it("includes the lesson title and course topic", () => {
    const result = buildQuizPrompt(baseParams);
    expect(result).toContain("Matrix Multiplication");
    expect(result).toContain("Linear Algebra");
  });

  it("includes lesson content when provided", () => {
    const content = { sections: [{ type: "text", body: "Some content" }] };
    const result = buildQuizPrompt({ ...baseParams, lessonContent: content });
    expect(result).toContain("LESSON CONTENT");
    expect(result).toContain("Some content");
  });

  it("does not include LESSON CONTENT section when lessonContent is omitted", () => {
    const result = buildQuizPrompt(baseParams);
    expect(result).not.toContain("LESSON CONTENT");
  });
});

describe("buildDiagnosticPrompt", () => {
  const baseParams = {
    courseTitle: "Intro to Linear Algebra",
    courseTopic: "Linear Algebra",
    courseDescription: "A beginner course on linear algebra",
    difficulty: "beginner",
    lessonTitles: ["Vectors", "Matrices", "Determinants"],
  };

  it("does not include language instruction without language param", () => {
    const result = buildDiagnosticPrompt(baseParams);
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it("does not include language instruction with language 'en'", () => {
    const result = buildDiagnosticPrompt({ ...baseParams, language: "en" });
    expect(result).not.toContain("LANGUAGE REQUIREMENT");
  });

  it('includes Polish language instruction with language "pl"', () => {
    const result = buildDiagnosticPrompt({ ...baseParams, language: "pl" });
    expect(result).toContain("LANGUAGE REQUIREMENT");
    expect(result).toContain("Polish");
  });

  it("includes course title and description", () => {
    const result = buildDiagnosticPrompt(baseParams);
    expect(result).toContain("Intro to Linear Algebra");
    expect(result).toContain("A beginner course on linear algebra");
  });

  it("includes lesson titles joined by comma", () => {
    const result = buildDiagnosticPrompt(baseParams);
    expect(result).toContain("Vectors, Matrices, Determinants");
  });
});
