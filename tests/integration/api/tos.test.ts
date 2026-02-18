import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH as tosPatch } from "@/app/api/user/tos/route";
import { GET as statusGet } from "@/app/api/user/status/route";
import { getTestPrisma } from "../helpers/db";
import { TEST_USER_ID } from "../helpers/fixtures";
import * as authUtils from "@/lib/auth-utils";
import { __resetRateLimitStore } from "@/lib/rate-limit";

function tosRequest() {
  return new Request("http://localhost/api/user/tos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
}

describe("Terms of Service enforcement", () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });

  describe("GET /api/user/status — tosAccepted field", () => {
    it("returns tosAccepted=false for a new user who has not accepted ToS", async () => {
      const response = await statusGet();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tosAccepted).toBe(false);
    });

    it("returns tosAccepted=true after user accepts current ToS version", async () => {
      const prisma = getTestPrisma();
      await prisma.user.update({
        where: { id: TEST_USER_ID },
        data: { tosAcceptedAt: new Date(), tosVersion: "1.0" },
      });

      const response = await statusGet();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tosAccepted).toBe(true);
    });

    it("returns tosAccepted=false when user accepted an outdated ToS version", async () => {
      const prisma = getTestPrisma();
      await prisma.user.update({
        where: { id: TEST_USER_ID },
        data: { tosAcceptedAt: new Date(), tosVersion: "0.9" },
      });

      const response = await statusGet();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tosAccepted).toBe(false);
    });

    it("returns tosAccepted=false when tosAcceptedAt is set but tosVersion is null", async () => {
      const prisma = getTestPrisma();
      await prisma.user.update({
        where: { id: TEST_USER_ID },
        data: { tosAcceptedAt: new Date(), tosVersion: null },
      });

      const response = await statusGet();
      const data = await response.json();
      expect(data.tosAccepted).toBe(false);
    });
  });

  describe("PATCH /api/user/tos — accept ToS", () => {
    it("accepts ToS and sets version and timestamp", async () => {
      const prisma = getTestPrisma();

      const response = await tosPatch(tosRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.accepted).toBe(true);
      expect(data.version).toBe("1.0");

      // Verify DB state
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      expect(user?.tosVersion).toBe("1.0");
      expect(user?.tosAcceptedAt).toBeTruthy();
    });

    it("allows pending users to accept ToS", async () => {
      const prisma = getTestPrisma();
      await prisma.user.update({
        where: { id: TEST_USER_ID },
        data: { accessStatus: "pending", accessGrantedAt: null, accessSource: null },
      });

      vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
        userId: TEST_USER_ID,
        role: "user",
        accessStatus: "pending",
        error: null,
      });

      const response = await tosPatch(tosRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.accepted).toBe(true);

      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      expect(user?.tosVersion).toBe("1.0");
    });

    it("rejects unauthenticated requests", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(authUtils.getAuthUserAnyStatusFromRequest).mockResolvedValueOnce({
        userId: null as unknown as string,
        role: null as unknown as string,
        accessStatus: null as unknown as string,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      });

      const response = await tosPatch(tosRequest());
      expect(response.status).toBe(401);
    });
  });

  describe("status → ToS → status round-trip", () => {
    it("new user starts with tosAccepted=false, accepts, then tosAccepted=true", async () => {
      // Step 1: status shows not accepted
      const statusBefore = await statusGet();
      const dataBefore = await statusBefore.json();
      expect(dataBefore.tosAccepted).toBe(false);

      // Step 2: accept ToS
      const acceptRes = await tosPatch(tosRequest());
      expect(acceptRes.status).toBe(200);

      // Step 3: status now shows accepted
      const statusAfter = await statusGet();
      const dataAfter = await statusAfter.json();
      expect(dataAfter.tosAccepted).toBe(true);
    });
  });
});
