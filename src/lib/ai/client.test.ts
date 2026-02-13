import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getApiKeyFromRequest, MODELS } from "./client";

describe("getApiKeyFromRequest", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("returns key from x-api-key header", () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-key": "sk-test-123" },
    });
    expect(getApiKeyFromRequest(request)).toBe("sk-test-123");
  });

  it("falls back to ANTHROPIC_API_KEY env var", () => {
    process.env.ANTHROPIC_API_KEY = "sk-env-456";
    const request = new Request("http://localhost:3000/api/test");
    expect(getApiKeyFromRequest(request)).toBe("sk-env-456");
  });

  it("prefers header over env var", () => {
    process.env.ANTHROPIC_API_KEY = "sk-env-456";
    const request = new Request("http://localhost:3000/api/test", {
      headers: { "x-api-key": "sk-header-789" },
    });
    expect(getApiKeyFromRequest(request)).toBe("sk-header-789");
  });

  it("returns null when neither header nor env var set", () => {
    const request = new Request("http://localhost:3000/api/test");
    expect(getApiKeyFromRequest(request)).toBeNull();
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
