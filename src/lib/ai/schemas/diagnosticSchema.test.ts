import { describe, it, expect } from "vitest";
import { diagnosticSchema } from "./diagnosticSchema";
import { mockDiagnostic } from "../mockData";

describe("diagnosticSchema", () => {
  it("validates mock diagnostic data", () => {
    const data = mockDiagnostic();
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts any number of questions", () => {
    const data = mockDiagnostic();
    data.questions = data.questions.slice(0, 5);
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid importance enum", () => {
    const data = mockDiagnostic();
    data.prerequisites[0].importance = "critical" as never;
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("accepts valid importance values", () => {
    const data = mockDiagnostic();
    data.prerequisites = [
      { topic: "A", importance: "essential", description: "..." },
      { topic: "B", importance: "helpful", description: "..." },
      { topic: "C", importance: "optional", description: "..." },
    ];
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects missing prerequisites", () => {
    const data = mockDiagnostic();
    const { prerequisites, ...rest } = data;
    const result = diagnosticSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts any number of choices", () => {
    const data = mockDiagnostic();
    data.questions[0].choices = data.questions[0].choices.slice(0, 2);
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates diagnostic question has prerequisiteTopic", () => {
    const data = mockDiagnostic();
    for (const q of data.questions) {
      expect(q).toHaveProperty("prerequisiteTopic");
      expect(typeof q.prerequisiteTopic).toBe("string");
    }
  });

  it("rejects invalid difficulty enum", () => {
    const data = mockDiagnostic();
    data.questions[0].difficulty = "nightmare" as never;
    const result = diagnosticSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
