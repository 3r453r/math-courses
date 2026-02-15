import { describe, it, expect } from "vitest";
import { quizSchema } from "./quizSchema";
import { mockQuiz } from "../mockData";

describe("quizSchema", () => {
  it("validates mock quiz data", () => {
    const data = mockQuiz();
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts any number of questions", () => {
    const data = mockQuiz();
    data.questions = data.questions.slice(0, 5);
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts any number of choices", () => {
    const data = mockQuiz();
    data.questions[0].choices = data.questions[0].choices.slice(0, 2);
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid difficulty enum", () => {
    const data = mockQuiz();
    data.questions[0].difficulty = "extreme" as never;
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing questions field", () => {
    const result = quizSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects missing questionText", () => {
    const data = mockQuiz();
    const { questionText, ...rest } = data.questions[0];
    data.questions[0] = rest as never;
    const result = quizSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("validates all choices have required fields", () => {
    const data = mockQuiz();
    for (const q of data.questions) {
      for (const c of q.choices) {
        expect(c).toHaveProperty("id");
        expect(c).toHaveProperty("text");
        expect(c).toHaveProperty("correct");
        expect(c).toHaveProperty("explanation");
      }
    }
  });
});
