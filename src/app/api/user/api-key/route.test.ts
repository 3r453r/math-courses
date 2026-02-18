import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMocks,
}));

vi.mock("@/lib/auth-utils", () => ({
  getAuthUser: vi.fn(async () => ({ userId: "user-1", error: null })),
}));

vi.mock("@/lib/crypto", () => ({
  encryptApiKey: vi.fn((value: string) => ({ encrypted: `enc-${value}`, iv: "iv" })),
  decryptApiKey: vi.fn((encrypted: string) => {
    if (encrypted === "enc-secret-key") return "sk-test-secret-key";
    return "legacy-secret-key";
  }),
}));

describe("GET /api/user/api-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns metadata only for encrypted keys and never plaintext values", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      encryptedApiKeys: JSON.stringify({
        anthropic: {
          encrypted: "enc-secret-key",
          iv: "iv",
          lastUpdated: "2025-01-01T00:00:00.000Z",
        },
      }),
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      apiKeys: {
        anthropic: {
          present: true,
          maskedSuffix: "-key",
          lastUpdated: "2025-01-01T00:00:00.000Z",
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("sk-test-secret-key");
  });

  it("handles legacy JSON structures without exposing plaintext keys", async () => {
    prismaMocks.user.findUnique.mockResolvedValue({
      encryptedApiKeys: JSON.stringify({
        openai: "sk-legacy-1234",
      }),
    });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.apiKeys.openai.present).toBe(true);
    expect(body.apiKeys.openai.maskedSuffix).toBe("-key");
    expect(JSON.stringify(body)).not.toContain("sk-legacy-1234");
  });
});
