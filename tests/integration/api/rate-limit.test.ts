import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST as testKeyPost } from "@/app/api/test-key/route";
import { __resetRateLimitStore } from "@/lib/rate-limit";

describe("API rate limiting", () => {
  beforeEach(() => {
    __resetRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    __resetRateLimitStore();
  });

  it("returns 429 with Retry-After when route limits are exceeded", async () => {
    for (let i = 0; i < 10; i += 1) {
      const response = await testKeyPost(
        new Request("http://localhost/api/test-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openai", apiKey: "k" }),
        })
      );
      expect(response.status).toBe(200);
    }

    const blocked = await testKeyPost(
      new Request("http://localhost/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "k" }),
      })
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });

  it("resets limits after the window elapses", async () => {
    for (let i = 0; i < 10; i += 1) {
      await testKeyPost(
        new Request("http://localhost/api/test-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openai", apiKey: "k" }),
        })
      );
    }

    const blocked = await testKeyPost(
      new Request("http://localhost/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "k" }),
      })
    );
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(61_000);

    const allowedAfterReset = await testKeyPost(
      new Request("http://localhost/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "k" }),
      })
    );
    expect(allowedAfterReset.status).toBe(200);
  });
});
