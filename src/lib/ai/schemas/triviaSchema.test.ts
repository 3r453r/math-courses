import { describe, it, expect } from "vitest";
import { triviaSchema } from "./triviaSchema";
import { mockTrivia } from "../mockData";

describe("triviaSchema", () => {
  it("validates mock trivia data", () => {
    const data = mockTrivia();
    const result = triviaSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts valid slides", () => {
    const data = {
      slides: [
        {
          title: "Test Trivia",
          fact: "This is a fun fact about $e^{i\\pi} + 1 = 0$.",
          funRating: "mind-blowing" as const,
        },
      ],
    };
    const result = triviaSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid funRating enum", () => {
    const data = {
      slides: [
        {
          title: "Test",
          fact: "A fact.",
          funRating: "amazing",
        },
      ],
    };
    const result = triviaSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing title field", () => {
    const data = {
      slides: [
        {
          fact: "A fact.",
          funRating: "cool",
        },
      ],
    };
    const result = triviaSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing fact field", () => {
    const data = {
      slides: [
        {
          title: "Title",
          funRating: "neat",
        },
      ],
    };
    const result = triviaSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing slides field", () => {
    const result = triviaSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts empty slides array", () => {
    const result = triviaSchema.safeParse({ slides: [] });
    expect(result.success).toBe(true);
  });

  it("validates all mock slides have required fields", () => {
    const data = mockTrivia();
    for (const slide of data.slides) {
      expect(slide).toHaveProperty("title");
      expect(slide).toHaveProperty("fact");
      expect(slide).toHaveProperty("funRating");
      expect(["mind-blowing", "cool", "neat"]).toContain(slide.funRating);
    }
  });

  it("mock trivia has 20 slides", () => {
    const data = mockTrivia();
    expect(data.slides).toHaveLength(20);
  });
});
