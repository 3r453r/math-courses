import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { z } from "zod";
import { tryCoerceAndValidate, unwrapParameter, type WrapperType } from "./repairSchema";

export type AIProvider = "anthropic" | "openai" | "google";

export interface ProviderApiKeys {
  anthropic?: string;
  openai?: string;
  google?: string;
}

export interface ProviderModelInfo {
  id: string;
  label: string;
  provider: AIProvider;
  tier: "premium" | "balanced" | "fast";
}

export const MODEL_REGISTRY: ProviderModelInfo[] = [
  // Anthropic
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic", tier: "premium" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", tier: "balanced" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", tier: "fast" },
  // OpenAI
  { id: "gpt-5.2", label: "GPT-5.2", provider: "openai", tier: "premium" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", provider: "openai", tier: "fast" },
  { id: "o3-mini", label: "o3-mini", provider: "openai", tier: "balanced" },
  // Google
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "google", tier: "premium" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", tier: "balanced" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", tier: "fast" },
];

export function getProviderForModel(modelId: string): AIProvider {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o3-") || modelId.startsWith("o1-") || modelId.startsWith("o4-")) return "openai";
  if (modelId.startsWith("gemini-")) return "google";
  // Fallback: look up in registry
  const entry = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (entry) return entry.provider;
  throw new Error(`Unknown model provider for model: ${modelId}`);
}

export function getModelInstance(modelId: string, apiKeys: ProviderApiKeys) {
  const provider = getProviderForModel(modelId);
  const apiKey = apiKeys[provider];
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
  }
}

export function getApiKeysFromRequest(request: Request): ProviderApiKeys {
  // Primary: JSON-encoded x-api-keys header
  const keysHeader = request.headers.get("x-api-keys");
  if (keysHeader) {
    try {
      const parsed = JSON.parse(keysHeader) as ProviderApiKeys;
      return {
        anthropic: parsed.anthropic || process.env.ANTHROPIC_API_KEY || undefined,
        openai: parsed.openai || process.env.OPENAI_API_KEY || undefined,
        google: parsed.google || process.env.GOOGLE_AI_API_KEY || undefined,
      };
    } catch {
      // Fall through to legacy/env
    }
  }

  // Legacy: single x-api-key header (treat as anthropic)
  const legacyKey = request.headers.get("x-api-key");

  return {
    anthropic: legacyKey || process.env.ANTHROPIC_API_KEY || undefined,
    openai: process.env.OPENAI_API_KEY || undefined,
    google: process.env.GOOGLE_AI_API_KEY || undefined,
  };
}

export function hasAnyApiKey(keys: ProviderApiKeys): boolean {
  return Boolean(keys.anthropic || keys.openai || keys.google);
}

/**
 * Provider-specific options for generateObject/streamObject calls.
 * Forces Anthropic to use tool-calling mode instead of constrained decoding,
 * which has a ~180s server-side timeout for large schemas.
 */
export function getProviderOptions(modelId: string) {
  const provider = getProviderForModel(modelId);
  if (provider === "anthropic") {
    return {
      anthropic: {
        structuredOutputMode: "jsonTool" as const,
      },
    };
  }
  return undefined;
}

export interface RepairTracker {
  repairCalled: boolean;
  rawText: string | null;
  rawTextLength: number;
  repairResult: "coercion-success" | "unwrapped-only" | "json-parse-failed" | "returned-null" | null;
  wrapperType: WrapperType;
  error: string | null;
}

export function createRepairTracker(): RepairTracker {
  return {
    repairCalled: false,
    rawText: null,
    rawTextLength: 0,
    repairResult: null,
    wrapperType: null,
    error: null,
  };
}

/**
 * Factory that creates a repair function for generateObject.
 * Layer 1: Unwraps Anthropic's {"parameter":{...}} wrapping, then
 * runs programmatic schema coercion (strip unknown fields, coerce types,
 * normalize enums, default missing arrays).
 */
function isDebugDumpEnabled(): boolean {
  return process.env.AI_DEBUG_DUMPS === "true";
}

function dumpToFile(filename: string, data: string) {
  if (typeof window !== "undefined") return; // client-side: no-op
  if (!isDebugDumpEnabled()) return;

  try {
    // Dynamic require to avoid bundling Node.js modules for the browser
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("path");
    const dir = nodePath.join(process.cwd(), ".debug-dumps");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = nodePath.join(dir, filename);
    fs.writeFileSync(filePath, data, "utf-8");
    console.log(`[debug-dump] Written ${data.length} chars to ${filePath}`);
  } catch (err) {
    console.error(`[debug-dump] Failed to write ${filename}:`, err instanceof Error ? err.message : err);
  }
}

export { dumpToFile };

export function createRepairFunction(schema: z.ZodType, tracker?: RepairTracker) {
  return async ({ text, error }: { text: string; error: unknown }): Promise<string | null> => {
    if (tracker) {
      tracker.repairCalled = true;
      tracker.rawText = text;
      tracker.rawTextLength = text.length;
      tracker.error = error instanceof Error ? error.message : String(error);
    }
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      console.log(`[repair] Attempting repair. Raw text length: ${text.length}, error: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`[repair] Raw text first 1000 chars: ${text.substring(0, 1000)}`);
      console.log(`[repair] Raw text last 500 chars: ...${text.substring(Math.max(0, text.length - 500))}`);

      // Dump full raw text to file for analysis
      dumpToFile(`repair-${ts}.json`, text);

      let parsed = JSON.parse(text);
      const original = parsed;

      // Log top-level structure
      if (parsed && typeof parsed === "object") {
        const topKeys = Object.keys(parsed);
        console.log(`[repair] Parsed top-level keys: [${topKeys.join(", ")}]`);
        if ("parameter" in parsed) {
          const paramType = typeof parsed.parameter;
          const paramPreview = paramType === "string"
            ? `string(length=${(parsed.parameter as string).length})`
            : paramType === "object" && parsed.parameter !== null
              ? `object(keys=[${Object.keys(parsed.parameter as object).join(", ")}])`
              : paramType;
          console.log(`[repair] Found "parameter" wrapper, type=${paramPreview}`);
        }
      }

      // Unwrap Anthropic {"parameter":...} wrapping (object or stringified JSON)
      if (parsed && typeof parsed === "object") {
        const { unwrapped, wasWrapped, wrapperType } = unwrapParameter(parsed as Record<string, unknown>);
        if (wasWrapped) {
          parsed = unwrapped;
          if (tracker) tracker.wrapperType = wrapperType;
        }
      }

      // Try schema coercion
      const coerced = tryCoerceAndValidate(parsed, schema);
      if (coerced !== null) {
        console.log("[repair] Schema coercion succeeded");
        if (tracker) tracker.repairResult = "coercion-success";
        return JSON.stringify(coerced);
      }

      console.log("[repair] Schema coercion failed, returning unwrapped version for AI SDK error reporting");

      // If coercion didn't fully fix it, still return the unwrapped version
      // (the original behavior) so the AI SDK can report the actual validation error
      if (parsed !== original) {
        if (tracker) tracker.repairResult = "unwrapped-only";
        return JSON.stringify(parsed);
      }

      if (tracker) tracker.repairResult = "returned-null";
    } catch (err) {
      console.error(`[repair] JSON parse failed:`, err instanceof Error ? err.message : err);
      if (tracker) {
        tracker.repairResult = "json-parse-failed";
        tracker.error = err instanceof Error ? err.message : String(err);
      }
    }
    return null;
  };
}

// Default model IDs
export const MODELS = {
  generation: "claude-opus-4-6",
  chat: "claude-sonnet-4-5-20250929",
} as const;
