import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/voice/interpret/route";

describe("POST /api/voice/interpret", () => {
  it("returns 401 without API key", async () => {
    const request = new Request("http://localhost:3000/api/voice/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "hello" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("API key required");
  });

  it("returns 400 without transcript", async () => {
    const request = new Request("http://localhost:3000/api/voice/interpret", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("transcript required");
  });

  it("returns 400 when transcript is not a string", async () => {
    const request = new Request("http://localhost:3000/api/voice/interpret", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-key",
      },
      body: JSON.stringify({ transcript: 123 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("transcript required");
  });
});
