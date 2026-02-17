import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { __resetRateLimitStore } from "@/lib/rate-limit";

vi.mock("@/lib/dev-bypass", () => ({
  isDevBypassEnabled: vi.fn(() => false),
}));

describe("proxy edge rate limits", () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });

  it("allows normal public API traffic within threshold", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/version"));
    expect(response.status).toBe(200);
  });

  it("blocks sensitive API endpoints after threshold", async () => {
    const endpoint = "http://localhost/api/test-key";

    for (let i = 0; i < 30; i += 1) {
      const response = await proxy(new NextRequest(endpoint));
      expect(response.status).toBe(401);
    }

    const blocked = await proxy(new NextRequest(endpoint));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
