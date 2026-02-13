import { describe, it, expect } from "vitest";
import {
  mockCourseStructure,
  mockLessonContent,
  mockQuiz,
  mockDiagnostic,
} from "./mockData";
import { courseStructureSchema } from "./schemas/courseSchema";
import { quizSchema } from "./schemas/quizSchema";
import { diagnosticSchema } from "./schemas/diagnosticSchema";

describe("mockCourseStructure", () => {
  it("returns schema-compliant data", () => {
    const data = mockCourseStructure();
    const result = courseStructureSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("has at least one lesson", () => {
    const data = mockCourseStructure();
    expect(data.lessons.length).toBeGreaterThanOrEqual(1);
  });

  it("has a title and description", () => {
    const data = mockCourseStructure();
    expect(data.title).toBeTruthy();
    expect(data.description).toBeTruthy();
  });

  it("lessons have required fields", () => {
    const data = mockCourseStructure();
    for (const lesson of data.lessons) {
      expect(lesson.title).toBeTruthy();
      expect(lesson.summary).toBeTruthy();
      expect(typeof lesson.orderIndex).toBe("number");
      expect(Array.isArray(lesson.prerequisites)).toBe(true);
      expect(Array.isArray(lesson.keyTopics)).toBe(true);
    }
  });
});

describe("mockLessonContent", () => {
  it("returns content with required fields", () => {
    const data = mockLessonContent();
    expect(data.title).toBeTruthy();
    expect(data.summary).toBeTruthy();
    expect(Array.isArray(data.learningObjectives)).toBe(true);
    expect(Array.isArray(data.sections)).toBe(true);
    expect(Array.isArray(data.workedExamples)).toBe(true);
    expect(Array.isArray(data.practiceExercises)).toBe(true);
    expect(Array.isArray(data.keyTakeaways)).toBe(true);
  });

  it("has at least one section", () => {
    const data = mockLessonContent();
    expect(data.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("has sections with valid types", () => {
    const data = mockLessonContent();
    const validTypes = ["text", "math", "definition", "theorem", "visualization"];
    for (const section of data.sections) {
      expect(validTypes).toContain(section.type);
    }
  });

  it("has at least one worked example", () => {
    const data = mockLessonContent();
    expect(data.workedExamples.length).toBeGreaterThanOrEqual(1);
    expect(data.workedExamples[0].title).toBeTruthy();
    expect(data.workedExamples[0].steps.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one practice exercise", () => {
    const data = mockLessonContent();
    expect(data.practiceExercises.length).toBeGreaterThanOrEqual(1);
    expect(data.practiceExercises[0].id).toBeTruthy();
    expect(data.practiceExercises[0].problemStatement).toBeTruthy();
  });
});

describe("mockQuiz", () => {
  it("returns schema-compliant data", () => {
    const data = mockQuiz();
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("has exactly 10 questions", () => {
    const data = mockQuiz();
    expect(data.questions).toHaveLength(10);
  });

  it("each question has 4 choices", () => {
    const data = mockQuiz();
    for (const q of data.questions) {
      expect(q.choices).toHaveLength(4);
    }
  });

  it("each question has exactly one correct answer", () => {
    const data = mockQuiz();
    for (const q of data.questions) {
      const correctCount = q.choices.filter((c) => c.correct).length;
      expect(correctCount).toBe(1);
    }
  });

  it("questions have topic and difficulty", () => {
    const data = mockQuiz();
    for (const q of data.questions) {
      expect(q.topic).toBeTruthy();
      expect(["easy", "medium", "hard"]).toContain(q.difficulty);
    }
  });
});

describe("mockDiagnostic", () => {
  it("returns schema-compliant data", () => {
    const data = mockDiagnostic();
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("has prerequisites", () => {
    const data = mockDiagnostic();
    expect(data.prerequisites.length).toBeGreaterThanOrEqual(1);
  });

  it("has 10 questions", () => {
    const data = mockDiagnostic();
    expect(data.questions).toHaveLength(10);
  });

  it("each question has prerequisiteTopic", () => {
    const data = mockDiagnostic();
    for (const q of data.questions) {
      expect(q.prerequisiteTopic).toBeTruthy();
    }
  });

  it("prerequisites have valid importance values", () => {
    const data = mockDiagnostic();
    for (const p of data.prerequisites) {
      expect(["essential", "helpful", "optional"]).toContain(p.importance);
    }
  });
});
