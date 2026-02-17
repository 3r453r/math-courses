import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { RepairTracker } from "./client";
import { getProviderForModel } from "./client";
import type { WrapperType } from "./repairSchema";
import { sanitizePromptForPersistence, sanitizeTextForPersistence } from "./logSanitizer";
import { getSensitiveTextExpiryDate } from "./generationLogRetention";

const RAW_TEXT_MAX_BYTES = 200 * 1024; // 200KB

export type GenerationType =
  | "course"
  | "lesson"
  | "quiz"
  | "diagnostic"
  | "trivia"
  | "completion_summary";

export type GenerationOutcome =
  | "success"
  | "repaired_layer0"
  | "repaired_layer1"
  | "repaired_layer2"
  | "failed";

export interface GenerationLogContext {
  generationType: GenerationType;
  schemaName: string;
  modelId: string;
  userId?: string;
  courseId?: string;
  lessonId?: string;
  language?: string;
  difficulty?: string;
  promptText?: string;
}

interface Layer1Data {
  rawText: string;
  hadWrapper: boolean;
  wrapperType?: WrapperType;
  success: boolean;
  zodErrors?: z.ZodIssue[];
}

interface Layer2Data {
  modelId: string;
  success: boolean;
}

export class GenerationLogger {
  private context: GenerationLogContext;
  private startTime: number;
  private finalized = false;

  // Layer 0
  private _layer0Called = false;
  private _layer0Result: string | null = null;
  private _layer0Error: string | null = null;
  private _layer0RawText: string | null = null;
  private _layer0RawTextLength = 0;
  private _layer0WrapperType: WrapperType = null;

  // Layer 1
  private _layer1Called = false;
  private _layer1Success = false;
  private _layer1HadWrapper = false;
  private _layer1WrapperType: WrapperType = null;
  private _layer1RawText: string | null = null;
  private _layer1ZodErrors: z.ZodIssue[] | undefined;

  // Layer 2
  private _layer2Called = false;
  private _layer2Success = false;
  private _layer2ModelId: string | null = null;

  // Failure
  private _errorMessage: string | null = null;

  constructor(context: GenerationLogContext) {
    this.context = context;
    this.startTime = Date.now();
  }

  /** Record Layer 0 data from the RepairTracker. Safe to call even if repair wasn't triggered. */
  recordLayer0(tracker: RepairTracker): void {
    this._layer0Called = tracker.repairCalled;
    this._layer0Result = tracker.repairResult;
    this._layer0Error = tracker.error;
    this._layer0RawText = tracker.rawText;
    this._layer0RawTextLength = tracker.rawTextLength;
    this._layer0WrapperType = tracker.wrapperType;
  }

  /** Record Layer 1 catch-block coercion attempt. */
  recordLayer1(data: Layer1Data): void {
    this._layer1Called = true;
    this._layer1Success = data.success;
    this._layer1HadWrapper = data.hadWrapper;
    this._layer1WrapperType = data.wrapperType ?? null;
    this._layer1RawText = data.rawText;
    this._layer1ZodErrors = data.zodErrors;
  }

  /** Record Layer 2 AI repack attempt. */
  recordLayer2(data: Layer2Data): void {
    this._layer2Called = true;
    this._layer2Success = data.success;
    this._layer2ModelId = data.modelId;
  }

  /** Record an unrecoverable failure. */
  recordFailure(errorMessage: string): void {
    this._errorMessage = errorMessage;
  }

  /** Determine the final outcome based on recorded layer results. */
  resolveOutcome(): GenerationOutcome {
    if (this._layer2Called && this._layer2Success) return "repaired_layer2";
    if (this._layer1Called && this._layer1Success) return "repaired_layer1";
    if (this._layer0Called && this._layer0Result === "coercion-success") return "repaired_layer0";

    // If any layer was called but none succeeded, it's failed
    if (this._layer2Called || this._layer1Called) return "failed";
    // Layer 0 was called but didn't produce coercion-success
    if (this._layer0Called && this._layer0Result !== null && this._layer0Result !== "coercion-success") {
      // Layer 0 returned "unwrapped-only" means the SDK got a better error but still threw —
      // except if no further layers were called, the SDK accepted the unwrapped version
      // Actually if we got here without layer1/layer2, the generateObject succeeded after repair
      if (this._layer0Result === "unwrapped-only") return "repaired_layer0";
      // json-parse-failed or returned-null without further layers means generateObject still threw
      return "failed";
    }

    // If there's an error message and no successful layer, it's failed
    if (this._errorMessage) return "failed";

    return "success";
  }

  /** Truncate raw text to the max size with a marker. */
  private truncateRawText(text: string | null): string | null {
    if (text === null) return null;
    if (text.length <= RAW_TEXT_MAX_BYTES) return text;
    const omitted = text.length - RAW_TEXT_MAX_BYTES;
    return text.substring(0, RAW_TEXT_MAX_BYTES) + `\n[TRUNCATED: ${omitted} chars omitted]`;
  }

  /** Get the best available raw text (prefer Layer 1's text since it's from the error). */
  private getRawText(): { text: string | null; length: number } {
    // Layer 1 raw text is from NoObjectGeneratedError.text — most useful for debugging
    if (this._layer1RawText) {
      return { text: this._layer1RawText, length: this._layer1RawText.length };
    }
    // Fallback to Layer 0's raw text
    if (this._layer0RawText) {
      return { text: this._layer0RawText, length: this._layer0RawTextLength };
    }
    return { text: null, length: 0 };
  }



  /**
   * Write one row to AiGenerationLog. Fire-and-forget (never throws).
   * Has double-call guard (idempotent).
   */
  async finalize(): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;

    try {
      const outcome = this.resolveOutcome();
      const durationMs = Date.now() - this.startTime;
      const { text: rawText, length: rawLen } = this.getRawText();

      // Only store prompt on non-success outcomes (saves space)
      const isNonSuccess = outcome !== "success";
      const rawSanitized = sanitizeTextForPersistence(rawText, "rawOutput");
      const promptSanitized = isNonSuccess
        ? sanitizePromptForPersistence(this.context.promptText ?? null)
        : { sanitized: null, redacted: false, hash: this.context.promptText ? sanitizePromptForPersistence(this.context.promptText).hash : null };
      const promptHash = promptSanitized.hash;

      const hasSensitivePayload = Boolean(rawSanitized.sanitized || promptSanitized.sanitized);
      const sensitiveTextExpiresAt = hasSensitivePayload ? getSensitiveTextExpiryDate() : null;

      // Serialize Zod errors
      let zodErrors: string | null = null;
      if (this._layer1ZodErrors && this._layer1ZodErrors.length > 0) {
        zodErrors = JSON.stringify(
          this._layer1ZodErrors.map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          }))
        );
      }

      let provider: string;
      try {
        provider = getProviderForModel(this.context.modelId);
      } catch {
        provider = "unknown";
      }

      // Best wrapper type: prefer Layer 1 (catch block) over Layer 0 (repair function)
      const wrapperType = this._layer1WrapperType ?? this._layer0WrapperType ?? null;

      await prisma.aiGenerationLog.create({
        data: {
          generationType: this.context.generationType,
          schemaName: this.context.schemaName,
          modelId: this.context.modelId,
          provider,
          userId: this.context.userId ?? null,
          courseId: this.context.courseId ?? null,
          lessonId: this.context.lessonId ?? null,
          outcome,
          durationMs,
          layer0Called: this._layer0Called,
          layer0Result: this._layer0Result,
          layer0Error: this._layer0Error,
          layer1Called: this._layer1Called,
          layer1Success: this._layer1Success,
          layer1HadWrapper: this._layer1HadWrapper,
          wrapperType,
          layer2Called: this._layer2Called,
          layer2Success: this._layer2Success,
          layer2ModelId: this._layer2ModelId,
          rawOutputText: this.truncateRawText(rawSanitized.sanitized),
          rawOutputLen: rawLen > 0 ? rawLen : null,
          rawOutputRedacted: rawSanitized.redacted,
          zodErrors,
          errorMessage: this._errorMessage,
          promptHash,
          promptText: promptSanitized.sanitized,
          promptRedacted: promptSanitized.redacted,
          sensitiveTextExpiresAt,
          sensitiveTextRedactedAt: null,
          language: this.context.language ?? null,
          difficulty: this.context.difficulty ?? null,
        },
      });
    } catch (err) {
      console.error(
        "[GenerationLogger] Failed to write log:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

export function createGenerationLogger(
  context: GenerationLogContext
): GenerationLogger {
  return new GenerationLogger(context);
}
