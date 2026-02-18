import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as redeemPost } from "@/app/api/access-codes/redeem/route";
import { GET as listCodes, POST as generateCodes } from "@/app/api/access-codes/route";
import { DELETE as deactivateCode } from "@/app/api/access-codes/[codeId]/route";
import { getTestPrisma } from "../helpers/db";
import { TEST_USER_ID } from "../helpers/fixtures";
import * as authUtils from "@/lib/auth-utils";
import { __resetRateLimitStore } from "@/lib/rate-limit";

describe("access code redemption", () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });
  it("redeems a valid access code and activates user", async () => {
    const prisma = getTestPrisma();

    // Set user to pending status
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accessStatus: "pending", accessGrantedAt: null, accessSource: null },
    });

    // Create an access code
    const code = await prisma.accessCode.create({
      data: { code: "TESTCODE", type: "general", maxUses: 5, currentUses: 0 },
    });

    // Mock getAuthUserAnyStatus for pending user
    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
      userId: TEST_USER_ID,
      role: "user",
      accessStatus: "pending",
      error: null,
    });

    const response = await redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "TESTCODE" }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify user is now active
    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.accessStatus).toBe("active");
    expect(user?.accessSource).toBe("code");

    // Verify code usage incremented
    const updatedCode = await prisma.accessCode.findUnique({ where: { id: code.id } });
    expect(updatedCode?.currentUses).toBe(1);

    // Verify redemption record exists
    const redemption = await prisma.accessCodeRedemption.findFirst({
      where: { accessCodeId: code.id, userId: TEST_USER_ID },
    });
    expect(redemption).not.toBeNull();
  });

  it("rejects an invalid access code", async () => {
    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
      userId: TEST_USER_ID,
      role: "user",
      accessStatus: "pending",
      error: null,
    });

    const response = await redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "INVALID" }),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid access code");
  });

  it("rejects an expired access code", async () => {
    const prisma = getTestPrisma();
    await prisma.accessCode.create({
      data: {
        code: "EXPIRED1",
        type: "general",
        maxUses: 5,
        expiresAt: new Date("2020-01-01"),
      },
    });

    // Set user to pending
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accessStatus: "pending" },
    });

    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
      userId: TEST_USER_ID,
      role: "user",
      accessStatus: "pending",
      error: null,
    });

    const response = await redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "EXPIRED1" }),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid, expired, or exhausted access code");
  });

  it("rejects a maxed-out access code", async () => {
    const prisma = getTestPrisma();
    await prisma.accessCode.create({
      data: { code: "MAXEDOUT", type: "general", maxUses: 1, currentUses: 1 },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accessStatus: "pending" },
    });

    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
      userId: TEST_USER_ID,
      role: "user",
      accessStatus: "pending",
      error: null,
    });

    const response = await redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "MAXEDOUT" }),
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid, expired, or exhausted access code");
  });

  it("prevents double redemption by the same user", async () => {
    const prisma = getTestPrisma();

    // First set user to pending, create code, redeem it
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accessStatus: "pending" },
    });

    const code = await prisma.accessCode.create({
      data: { code: "DOUBLE01", type: "general", maxUses: 5 },
    });

    // Create existing redemption
    await prisma.accessCodeRedemption.create({
      data: { accessCodeId: code.id, userId: TEST_USER_ID },
    });

    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
      userId: TEST_USER_ID,
      role: "user",
      accessStatus: "pending",
      error: null,
    });

    const response = await redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "DOUBLE01" }),
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("You have already redeemed this code");

    const updatedCode = await prisma.accessCode.findUnique({ where: { id: code.id } });
    expect(updatedCode?.currentUses).toBe(0);
  });

  it("handles concurrent redemption attempts without over-consuming usage", async () => {
    const prisma = getTestPrisma();
    const secondUserId = "user-2";

    await prisma.user.create({
      data: {
        id: secondUserId,
        email: "second@example.com",
        name: "Second User",
        emailVerified: new Date(),
        accessStatus: "pending",
      },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accessStatus: "pending", accessGrantedAt: null, accessSource: null },
    });

    const code = await prisma.accessCode.create({
      data: { code: "RACE0001", type: "general", maxUses: 1, currentUses: 0 },
    });

    vi.mocked(authUtils.getAuthUserAnyStatusFromRequest)
      .mockResolvedValueOnce({ userId: TEST_USER_ID, role: "user", accessStatus: "pending", error: null })
      .mockResolvedValueOnce({ userId: secondUserId, role: "user", accessStatus: "pending", error: null });

    const req1 = redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "RACE0001" }),
      })
    );

    const req2 = redeemPost(
      new Request("http://localhost/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "RACE0001" }),
      })
    );

    const [response1, response2] = await Promise.all([req1, req2]);
    const statuses = [response1.status, response2.status].sort();

    expect(statuses).toEqual([200, 400]);

    const updatedCode = await prisma.accessCode.findUnique({ where: { id: code.id } });
    expect(updatedCode?.currentUses).toBe(1);

    const redemptions = await prisma.accessCodeRedemption.findMany({ where: { accessCodeId: code.id } });
    expect(redemptions).toHaveLength(1);
  });
});

describe("owner access code management", () => {
  beforeEach(() => {
    // Mock owner auth for these tests
    // GET uses requireOwner, POST uses requireOwnerFromRequest, DELETE uses requireOwnerFromRequest
    vi.mocked(authUtils.requireOwner).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "owner",
      accessStatus: "active",
      error: null,
    });
    vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "owner",
      accessStatus: "active",
      error: null,
    });
  });

  it("generates access codes (owner)", async () => {
    const response = await generateCodes(
      new Request("http://localhost/api/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3, maxUses: 10, type: "promo" }),
      })
    );

    expect(response.status).toBe(201);
    const codes = await response.json();
    expect(codes).toHaveLength(3);
    expect(codes[0].type).toBe("promo");
    expect(codes[0].maxUses).toBe(10);
    expect(codes[0].code).toHaveLength(8);
  });

  it("lists access codes with usage stats (owner)", async () => {
    const prisma = getTestPrisma();
    await prisma.accessCode.create({
      data: { code: "LISTTEST", type: "general", maxUses: 1, createdBy: TEST_USER_ID },
    });

    const response = await listCodes();
    expect(response.status).toBe(200);

    const codes = await response.json();
    expect(codes.length).toBeGreaterThanOrEqual(1);
    const found = codes.find((c: { code: string }) => c.code === "LISTTEST");
    expect(found).toBeDefined();
  });

  it("deactivates an access code (owner)", async () => {
    const prisma = getTestPrisma();
    const code = await prisma.accessCode.create({
      data: { code: "DEACT001", type: "general", maxUses: 1 },
    });

    const response = await deactivateCode(
      new Request(`http://localhost/api/access-codes/${code.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ codeId: code.id }) }
    );

    expect(response.status).toBe(200);

    const updated = await prisma.accessCode.findUnique({ where: { id: code.id } });
    expect(updated?.isActive).toBe(false);
  });
});
