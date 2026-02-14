import { describe, it, expect } from "vitest";
import { completionSummarySchema } from "./completionSummarySchema";

const validData = {
  narrative: "The student demonstrated strong understanding of linear algebra concepts...",
  recommendation: {
    type: "advanced" as const,
    suggestedTopic: "Abstract Algebra",
    suggestedDescription: "Explore groups, rings, and fields to build on your linear algebra foundation.",
    suggestedDifficulty: "advanced" as const,
    suggestedFocusAreas: ["Group Theory", "Ring Theory", "Field Extensions"],
    rationale: "Strong performance across all topics suggests readiness for more abstract concepts.",
  },
};

describe("completionSummarySchema", () => {
  it("validates a complete valid object", () => {
    const result = completionSummarySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing narrative", () => {
    const { narrative, ...rest } = validData;
    const result = completionSummarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing recommendation", () => {
    const { recommendation, ...rest } = validData;
    const result = completionSummarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid recommendation type", () => {
    const data = {
      ...validData,
      recommendation: { ...validData.recommendation, type: "invalid" },
    };
    const result = completionSummarySchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const data = {
      ...validData,
      recommendation: { ...validData.recommendation, suggestedDifficulty: "expert" },
    };
    const result = completionSummarySchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 3 focus areas", () => {
    const data = {
      ...validData,
      recommendation: { ...validData.recommendation, suggestedFocusAreas: ["one", "two"] },
    };
    const result = completionSummarySchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("accepts all valid recommendation types", () => {
    for (const type of ["deeper", "broader", "weakness-focused", "advanced"]) {
      const data = {
        ...validData,
        recommendation: { ...validData.recommendation, type },
      };
      const result = completionSummarySchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });
});
