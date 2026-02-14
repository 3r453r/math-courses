import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getApiKeysFromRequest, getProviderForModel, hasAnyApiKey, MODELS } from "./client";

describe("getApiKeysFromRequest", () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_AI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
  });

  afterEach(() => {
    const restore = (key: string, val: string | undefined) => {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    };
    restore("ANTHROPIC_API_KEY", originalAnthropicKey);
    restore("OPENAI_API_KEY", originalOpenAIKey);
    restore("GOOGLE_AI_API_KEY", originalGoogleKey);
  });

  it("parses x-api-keys JSON header", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-keys": JSON.stringify({ anthropic: "sk-ant-123", openai: "sk-proj-456" }) },
    });
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBe("sk-ant-123");
    expect(keys.openai).toBe("sk-proj-456");
    expect(keys.google).toBeUndefined();
  });

  it("falls back to legacy x-api-key header as anthropic key", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-key": "sk-ant-legacy" },
    });
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBe("sk-ant-legacy");
  });

  it("falls back to env vars", () => {
    process.env.ANTHROPIC_API_KEY = "sk-env-ant";
    process.env.OPENAI_API_KEY = "sk-env-oai";
    const request = new Request("http://localhost:3000/api/test");
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBe("sk-env-ant");
    expect(keys.openai).toBe("sk-env-oai");
  });

  it("header keys take precedence over env vars", () => {
    process.env.ANTHROPIC_API_KEY = "sk-env-ant";
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-keys": JSON.stringify({ anthropic: "sk-header-ant" }) },
    });
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBe("sk-header-ant");
  });

  it("merges header keys with env vars", () => {
    process.env.OPENAI_API_KEY = "sk-env-oai";
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-keys": JSON.stringify({ anthropic: "sk-ant-123" }) },
    });
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBe("sk-ant-123");
    expect(keys.openai).toBe("sk-env-oai");
  });

  it("returns all undefined when nothing set", () => {
    const request = new Request("http://localhost:3000/api/test");
    const keys = getApiKeysFromRequest(request);
    expect(keys.anthropic).toBeUndefined();
    expect(keys.openai).toBeUndefined();
    expect(keys.google).toBeUndefined();
  });
});

describe("getProviderForModel", () => {
  it("detects anthropic models", () => {
    expect(getProviderForModel("claude-opus-4-6")).toBe("anthropic");
    expect(getProviderForModel("claude-sonnet-4-5-20250929")).toBe("anthropic");
  });

  it("detects openai models", () => {
    expect(getProviderForModel("gpt-5.2")).toBe("openai");
    expect(getProviderForModel("o3-mini")).toBe("openai");
  });

  it("detects google models", () => {
    expect(getProviderForModel("gemini-2.5-pro")).toBe("google");
    expect(getProviderForModel("gemini-2.5-flash")).toBe("google");
  });

  it("throws for unknown models", () => {
    expect(() => getProviderForModel("unknown-model")).toThrow("Unknown model provider");
  });
});

describe("hasAnyApiKey", () => {
  it("returns false for empty keys", () => {
    expect(hasAnyApiKey({})).toBe(false);
  });

  it("returns false for all undefined keys", () => {
    expect(hasAnyApiKey({ anthropic: undefined, openai: undefined, google: undefined })).toBe(false);
  });

  it("returns true when anthropic key present", () => {
    expect(hasAnyApiKey({ anthropic: "sk-ant-123" })).toBe(true);
  });

  it("returns true when openai key present", () => {
    expect(hasAnyApiKey({ openai: "sk-proj-456" })).toBe(true);
  });

  it("returns true when google key present", () => {
    expect(hasAnyApiKey({ google: "AIza-789" })).toBe(true);
  });
});

describe("MODELS", () => {
  it("has generation and chat model IDs", () => {
    expect(MODELS.generation).toBeTruthy();
    expect(MODELS.chat).toBeTruthy();
    expect(typeof MODELS.generation).toBe("string");
    expect(typeof MODELS.chat).toBe("string");
  });
});
