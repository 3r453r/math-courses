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

  it("allows GET requests regardless of Origin", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "GET",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response).toBeNull();
  });

  it("allows HEAD requests regardless of Origin", () => {
    const request = new Request("https://app.example.com/api/data", {
      method: "HEAD",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response).toBeNull();
  });

  it("blocks requests with missing Origin AND Referer", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("allows request with valid Referer when Origin is absent", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        referer: "https://app.example.com/courses/new",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response).toBeNull();
  });

  it("blocks request with cross-origin Referer when Origin is absent", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        referer: "https://evil.example.com/attack",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
  });

  it("blocks 'Origin: null' (privacy-redirect) requests", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        origin: "null",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
  });

  it("blocks DELETE requests with cross-origin", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/access-codes/123", {
      method: "DELETE",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
  });

  it("blocks PATCH requests with cross-origin", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    };

    const request = new Request("https://app.example.com/api/admin/users/123", {
      method: "PATCH",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response?.status).toBe(403);
  });

  it("skips CSRF validation in NEXT_TEST_MODE", () => {
    process.env = {
      ...originalEnv,
      NEXT_TEST_MODE: "1",
    };

    const request = new Request("https://app.example.com/api/courses", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const response = validateCsrfRequest(request);
    expect(response).toBeNull();
  });
});
