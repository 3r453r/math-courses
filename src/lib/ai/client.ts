import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

// Default model IDs
export const MODELS = {
  generation: "claude-opus-4-6",
  chat: "claude-sonnet-4-5-20250929",
} as const;
