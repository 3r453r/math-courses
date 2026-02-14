import { describe, it, expect } from "vitest";
import { buildCompletionSummaryPrompt } from "./completionSummary";

describe("buildCompletionSummaryPrompt", () => {
  const baseParams = {
    courseTitle: "Linear Algebra",
    courseTopic: "Linear Algebra",
    difficulty: "intermediate",
    contextDoc: null,
    focusAreas: ["Vector Spaces", "Eigenvalues"],
    summaryData: {
      totalLessons: 5,
      lessonsCompleted: 5,
      overallAverageScore: 0.85,
      perLesson: [
        {
          title: "Vectors and Spaces",
          bestScore: 0.9,
          weight: 1.0,
          quizGenerations: 1,
          weakTopicsAcrossAttempts: [],
        },
        {
          title: "Matrix Operations",
          bestScore: 0.75,
          weight: 2.0,
          quizGenerations: 2,
          weakTopicsAcrossAttempts: ["Matrix Multiplication"],
        },
      ],
      aggregateWeakTopics: [
        { topic: "Matrix Multiplication", frequency: 2, latestScore: 0.75 },
      ],
    },
    passThreshold: 0.8,
    noLessonCanFail: true,
    lessonFailureThreshold: 0.5,
    passed: true,
    language: "en",
  };

  it("includes course title and topic", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Linear Algebra");
  });

  it("includes difficulty level", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("intermediate");
  });

  it("includes focus areas", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Vector Spaces");
    expect(prompt).toContain("Eigenvalues");
  });

  it("includes per-lesson performance", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Vectors and Spaces");
    expect(prompt).toContain("90%");
    expect(prompt).toContain("Matrix Operations");
    expect(prompt).toContain("75%");
  });

  it("includes quiz generation counts", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("1 quiz generation(s)");
    expect(prompt).toContain("2 quiz generation(s)");
  });

  it("includes weak topics", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Matrix Multiplication");
    expect(prompt).toContain("appeared 2 time(s)");
  });

  it("includes overall average score", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("85%");
  });

  it("includes contextDoc when provided", () => {
    const prompt = buildCompletionSummaryPrompt({
      ...baseParams,
      contextDoc: "Use column vector notation throughout.",
    });
    expect(prompt).toContain("COURSE CONTEXT DOCUMENT");
    expect(prompt).toContain("column vector notation");
  });

  it("omits contextDoc section when null", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).not.toContain("COURSE CONTEXT DOCUMENT");
  });

  it("does not add language instruction for English", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).not.toContain("LANGUAGE REQUIREMENT");
  });

  it("adds language instruction for non-English", () => {
    const prompt = buildCompletionSummaryPrompt({ ...baseParams, language: "pl" });
    expect(prompt).toContain("LANGUAGE REQUIREMENT");
    expect(prompt).toContain("Polish");
  });

  it("includes pass threshold information", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Pass threshold: 80%");
  });

  it("includes no lesson can fail status", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("No lesson can be failed: Yes");
  });

  it("includes lesson failure threshold when noLessonCanFail is true", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Lesson failure threshold: 50%");
  });

  it("includes course result status", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("Course result: PASSED");
  });

  it("shows NOT YET PASSED when passed is false", () => {
    const prompt = buildCompletionSummaryPrompt({ ...baseParams, passed: false });
    expect(prompt).toContain("Course result: NOT YET PASSED");
  });

  it("includes lesson weights in per-lesson breakdown", () => {
    const prompt = buildCompletionSummaryPrompt(baseParams);
    expect(prompt).toContain("[weight: 1]");
    expect(prompt).toContain("[weight: 2]");
  });
});
