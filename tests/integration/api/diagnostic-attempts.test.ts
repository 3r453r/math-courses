import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/diagnostic-attempts/route";
import { mockDiagnostic } from "@/lib/ai/mockData";
import { createTestCourse, createTestDiagnostic } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";

describe("POST /api/diagnostic-attempts", () => {
  it("returns 400 without diagnosticQuizId or answers", async () => {
    const request = new Request(
      "http://localhost:3000/api/diagnostic-attempts",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent diagnostic", async () => {
    const request = new Request(
      "http://localhost:3000/api/diagnostic-attempts",
      {
        method: "POST",
        body: JSON.stringify({
          diagnosticQuizId: "nonexistent",
          answers: { d1: ["a"] },
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("scores diagnostic and creates attempt record", async () => {
    const prisma = getTestPrisma();
    const diagnosticData = mockDiagnostic();
    const course = await createTestCourse();
    const diagnostic = await createTestDiagnostic(course.id, {
      questionsJson: JSON.stringify(diagnosticData),
      status: "ready",
    });

    // Answer all correctly
    const answers: Record<string, string[]> = {};
    for (const q of diagnosticData.questions) {
      answers[q.id] = ["a"];
    }

    const request = new Request(
      "http://localhost:3000/api/diagnostic-attempts",
      {
        method: "POST",
        body: JSON.stringify({
          diagnosticQuizId: diagnostic.id,
          answers,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.result.score).toBe(1.0);
    expect(data.result.recommendation).toBe("advance");
    expect(data.prerequisites).toBeDefined();
    expect(data.prerequisites.length).toBeGreaterThan(0);

    // Verify DB record
    const attempts = await prisma.diagnosticAttempt.findMany({
      where: { diagnosticQuizId: diagnostic.id },
    });
    expect(attempts).toHaveLength(1);
  });

  it("returns weak areas for partially correct diagnostic", async () => {
    const diagnosticData = mockDiagnostic();
    const course = await createTestCourse();
    const diagnostic = await createTestDiagnostic(course.id, {
      questionsJson: JSON.stringify(diagnosticData),
      status: "ready",
    });

    // Answer first 3 correctly, rest wrong
    const answers: Record<string, string[]> = {};
    for (let i = 0; i < diagnosticData.questions.length; i++) {
      answers[diagnosticData.questions[i].id] = i < 3 ? ["a"] : ["b"];
    }

    const request = new Request(
      "http://localhost:3000/api/diagnostic-attempts",
      {
        method: "POST",
        body: JSON.stringify({
          diagnosticQuizId: diagnostic.id,
          answers,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();
    expect(data.result.score).toBe(0.3);
    expect(data.result.recommendation).toBe("regenerate");
    expect(data.result.weakTopics.length).toBeGreaterThan(0);
  });
});
