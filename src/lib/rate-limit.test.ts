import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimitStore, checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });

  it("falls back to IP key when userId is missing", () => {
    const config = { namespace: "test", windowMs: 60_000, maxRequests: 1 };
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const first = checkRateLimit({ request, config });
    const second = checkRateLimit({ request, config });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.key).toContain("ip:203.0.113.10");
  });
});
