import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerationLogger, createGenerationLogger } from "./generationLogger";
import type { RepairTracker } from "./client";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    aiGenerationLog: {
      create: vi.fn().mockResolvedValue({ id: "test-log-id" }),
    },
  },
}));

// Mock getProviderForModel
vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return {
    ...actual,
    getProviderForModel: vi.fn((modelId: string) => {
      if (modelId.startsWith("claude-")) return "anthropic";
      if (modelId.startsWith("gpt-")) return "openai";
      if (modelId.startsWith("gemini-")) return "google";
      return "unknown";
    }),
  };
});

import { prisma } from "@/lib/db";

function makeTracker(overrides: Partial<RepairTracker> = {}): RepairTracker {
  return {
    repairCalled: false,
    rawText: null,
    rawTextLength: 0,
    repairResult: null,
    wrapperType: null,
    error: null,
    ...overrides,
  };
}

describe("GenerationLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveOutcome", () => {
    it("returns 'success' when no layers were called", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      // Access resolveOutcome via finalize behavior — we test indirectly
      // by checking what's written to DB
      logger.recordLayer0(makeTracker());
      expect(logger.resolveOutcome()).toBe("success");
    });

    it("returns 'repaired_layer0' when layer0 coercion succeeded", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({
          repairCalled: true,
          repairResult: "coercion-success",
          rawText: '{"some":"data"}',
          rawTextLength: 15,
        })
      );
      expect(logger.resolveOutcome()).toBe("repaired_layer0");
    });

    it("returns 'repaired_layer0' when layer0 returned unwrapped-only (and no further layers)", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({
          repairCalled: true,
          repairResult: "unwrapped-only",
          rawText: '{"parameter":{"data":"x"}}',
          rawTextLength: 25,
        })
      );
      expect(logger.resolveOutcome()).toBe("repaired_layer0");
    });

    it("returns 'repaired_layer1' when layer1 succeeded", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({ repairCalled: true, repairResult: "returned-null" })
      );
      logger.recordLayer1({
        rawText: '{"some":"data"}',
        hadWrapper: false,
        success: true,
      });
      expect(logger.resolveOutcome()).toBe("repaired_layer1");
    });

    it("returns 'repaired_layer2' when layer2 succeeded", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({ repairCalled: true, repairResult: "returned-null" })
      );
      logger.recordLayer1({
        rawText: '{"some":"data"}',
        hadWrapper: false,
        success: false,
      });
      logger.recordLayer2({
        modelId: "claude-haiku-4-5-20251001",
        success: true,
      });
      expect(logger.resolveOutcome()).toBe("repaired_layer2");
    });

    it("returns 'failed' when all layers fail", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({ repairCalled: true, repairResult: "returned-null" })
      );
      logger.recordLayer1({
        rawText: '{"some":"data"}',
        hadWrapper: false,
        success: false,
      });
      logger.recordLayer2({
        modelId: "claude-haiku-4-5-20251001",
        success: false,
      });
      logger.recordFailure("No object generated");
      expect(logger.resolveOutcome()).toBe("failed");
    });

    it("returns 'failed' when layer0 json-parse-failed with no further layers", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({ repairCalled: true, repairResult: "json-parse-failed" })
      );
      logger.recordFailure("JSON parse error");
      expect(logger.resolveOutcome()).toBe("failed");
    });

    it("returns 'failed' when only recordFailure is called", () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordFailure("Network error");
      expect(logger.resolveOutcome()).toBe("failed");
    });
  });

  describe("raw text truncation", () => {
    it("stores text under 200KB as-is", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      const shortText = "x".repeat(200);
      logger.recordLayer1({
        rawText: shortText,
        hadWrapper: false,
        success: true,
      });
      await logger.finalize();

      const createCall = vi.mocked(prisma.aiGenerationLog.create);
      expect(createCall).toHaveBeenCalledOnce();
      const data = createCall.mock.calls[0][0].data;
      expect(data.rawOutputText).toBe(shortText);
      expect(data.rawOutputLen).toBe(200);
      expect(data.rawOutputRedacted).toBe(false);
    });

    it("truncates text over 200KB with marker", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      const bigText = "x".repeat(300_000);
      logger.recordLayer1({
        rawText: bigText,
        hadWrapper: false,
        success: false,
      });
      logger.recordFailure("too big");
      await logger.finalize();

      const createCall = vi.mocked(prisma.aiGenerationLog.create);
      const data = createCall.mock.calls[0][0].data;
      expect(data.rawOutputText).toContain("[REDACTED:rawOutput");
      expect(data.rawOutputRedacted).toBe(true);
      expect(data.rawOutputLen).toBe(300_000);
    });
  });

  describe("prompt storage policy", () => {
    it("stores prompt text on non-success outcomes", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
        promptText: "Generate a lesson about calculus",
      });
      logger.recordFailure("Something broke");
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.promptText).toBe("Generate a lesson about calculus");
      expect(data.promptHash).toBeTruthy();
    });

    it("does NOT store prompt text on success outcomes", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
        promptText: "Generate a lesson about calculus",
      });
      logger.recordLayer0(makeTracker());
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.promptText).toBeNull();
      // Hash is still stored for grouping
      expect(data.promptHash).toBeTruthy();
    });
  });


  describe("redaction and retention", () => {
    it("redacts long prompt sections and sets TTL fields", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
        promptText: `COURSE CONTEXT DOCUMENT:
${"x".repeat(2000)}

LESSON CONTENT GUIDELINES:
Keep it concise`,
      });
      logger.recordFailure("failed");
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.promptText).toContain("[REDACTED:contextDoc");
      expect(data.promptRedacted).toBe(true);
      expect(data.sensitiveTextExpiresAt).toBeTruthy();
      expect(data.sensitiveTextRedactedAt).toBeNull();
    });
  });

  describe("double-finalize guard", () => {
    it("only writes to DB once even if finalize() is called twice", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(makeTracker());
      await logger.finalize();
      await logger.finalize();

      expect(prisma.aiGenerationLog.create).toHaveBeenCalledOnce();
    });
  });

  describe("data capture", () => {
    it("records layer0 data from RepairTracker", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(
        makeTracker({
          repairCalled: true,
          repairResult: "coercion-success",
          rawText: '{"data":"test"}',
          rawTextLength: 15,
          error: "initial error",
        })
      );
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.layer0Called).toBe(true);
      expect(data.layer0Result).toBe("coercion-success");
      expect(data.layer0Error).toBe("initial error");
      expect(data.outcome).toBe("repaired_layer0");
    });

    it("records layer1 data with zodErrors", async () => {
      const logger = createGenerationLogger({
        generationType: "quiz",
        schemaName: "quizSchema",
        modelId: "gpt-5.2",
      });
      logger.recordLayer0(makeTracker({ repairCalled: true, repairResult: "returned-null" }));
      logger.recordLayer1({
        rawText: '{"bad":"data"}',
        hadWrapper: true,
        success: false,
        zodErrors: [
          { path: ["questions", 0, "type"], code: "invalid_enum_value" as const, message: "Invalid enum", expected: ["multiple_choice"], received: "mc" },
        ],
      });
      logger.recordFailure("schema mismatch");
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.layer1Called).toBe(true);
      expect(data.layer1Success).toBe(false);
      expect(data.layer1HadWrapper).toBe(true);
      expect(data.zodErrors).toBeTruthy();
      const zodErrors = JSON.parse(data.zodErrors!);
      expect(zodErrors).toHaveLength(1);
      expect(zodErrors[0].path).toEqual(["questions", 0, "type"]);
    });

    it("records layer2 data", async () => {
      const logger = createGenerationLogger({
        generationType: "diagnostic",
        schemaName: "diagnosticSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(makeTracker({ repairCalled: true, repairResult: "returned-null" }));
      logger.recordLayer1({
        rawText: "bad",
        hadWrapper: false,
        success: false,
      });
      logger.recordLayer2({
        modelId: "claude-haiku-4-5-20251001",
        success: true,
      });
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.layer2Called).toBe(true);
      expect(data.layer2Success).toBe(true);
      expect(data.layer2ModelId).toBe("claude-haiku-4-5-20251001");
      expect(data.outcome).toBe("repaired_layer2");
    });

    it("records context metadata", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
        userId: "user-123",
        courseId: "course-456",
        lessonId: "lesson-789",
        language: "pl",
        difficulty: "advanced",
      });
      logger.recordLayer0(makeTracker());
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.generationType).toBe("lesson");
      expect(data.schemaName).toBe("lessonContentSchema");
      expect(data.modelId).toBe("claude-opus-4-6");
      expect(data.provider).toBe("anthropic");
      expect(data.userId).toBe("user-123");
      expect(data.courseId).toBe("course-456");
      expect(data.lessonId).toBe("lesson-789");
      expect(data.language).toBe("pl");
      expect(data.difficulty).toBe("advanced");
    });

    it("records durationMs", async () => {
      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      // Small delay to ensure durationMs > 0
      await new Promise((r) => setTimeout(r, 10));
      logger.recordLayer0(makeTracker());
      await logger.finalize();

      const data = vi.mocked(prisma.aiGenerationLog.create).mock.calls[0][0].data;
      expect(data.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("does not throw when DB write fails", async () => {
      vi.mocked(prisma.aiGenerationLog.create).mockRejectedValueOnce(
        new Error("DB connection lost")
      );

      const logger = createGenerationLogger({
        generationType: "lesson",
        schemaName: "lessonContentSchema",
        modelId: "claude-opus-4-6",
      });
      logger.recordLayer0(makeTracker());

      // Should not throw
      await expect(logger.finalize()).resolves.toBeUndefined();
    });
  });

  describe("createGenerationLogger", () => {
    it("returns a GenerationLogger instance", () => {
      const logger = createGenerationLogger({
        generationType: "course",
        schemaName: "courseStructureSchema",
        modelId: "gpt-5.2",
      });
      expect(logger).toBeInstanceOf(GenerationLogger);
    });
  });
});
