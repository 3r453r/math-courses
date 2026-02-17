import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCsrfRequest } from "@/lib/csrf";

describe("validateCsrfRequest", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("blocks cross-origin POST requests", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("allows same-origin POST requests", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response).toBeNull();
  });
});
