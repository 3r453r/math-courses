import { createAnthropic } from "@ai-sdk/anthropic";

export function getAnthropicClient(apiKey: string) {
  return createAnthropic({ apiKey });
}

export function getApiKeyFromRequest(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;
  return process.env.ANTHROPIC_API_KEY ?? null;
}

// Default model IDs for multi-model support
export const MODELS = {
  generation: "claude-opus-4-20250514",  // High quality for lesson/quiz generation
  chat: "claude-sonnet-4-20250514",       // Fast for chat sidebar
} as const;
