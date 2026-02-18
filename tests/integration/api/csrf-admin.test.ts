import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { PATCH as patchUser } from "@/app/api/admin/users/[userId]/route";
import { PATCH as patchSiteConfig } from "@/app/api/admin/site-config/route";
import { POST as postGallery } from "@/app/api/admin/gallery/route";
import { POST as postAccessCodes } from "@/app/api/access-codes/route";
import { DELETE as deleteAccessCode } from "@/app/api/access-codes/[codeId]/route";
import { POST as postCleanup } from "@/app/api/admin/generation-logs/cleanup/route";
import { TEST_USER_ID } from "../helpers/fixtures";
import * as authUtils from "@/lib/auth-utils";
import * as csrf from "@/lib/csrf";

// Spy on the real CSRF validation
vi.mock("@/lib/csrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csrf")>();
  return {
    ...actual,
    validateCsrfRequest: vi.fn(actual.validateCsrfRequest),
  };
});

/**
 * These tests verify that admin/owner mutation endpoints enforce CSRF
 * by calling the FromRequest auth variants, which invoke validateCsrfRequest.
 *
 * We mock the FromRequest helpers to simulate CSRF rejection (cross-origin)
 * or acceptance (same-origin + owner/admin role).
 */
describe("CSRF protection on admin mutation routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function csrfRejection() {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  function ownerAuth() {
    return {
      userId: TEST_USER_ID,
      role: "owner",
      accessStatus: "active",
      error: null,
    };
  }

  function adminAuth() {
    return {
      userId: TEST_USER_ID,
      role: "admin",
      accessStatus: "active",
      error: null,
    };
  }

  describe("PATCH /api/admin/users/[userId]", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await patchUser(
        new Request("http://localhost/api/admin/users/some-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            origin: "https://evil.example.com",
          },
          body: JSON.stringify({ role: "admin" }),
        }),
        { params: Promise.resolve({ userId: "some-id" }) }
      );

      expect(response.status).toBe(403);
    });

    it("allows same-origin owner requests", async () => {
      vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValueOnce(ownerAuth());

      const response = await patchUser(
        new Request("http://localhost/api/admin/users/nonexistent", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            origin: "http://localhost",
          },
          body: JSON.stringify({ role: "admin" }),
        }),
        { params: Promise.resolve({ userId: "nonexistent" }) }
      );

      // 500 because the user doesn't exist in test DB — but not 403, which is the point
      expect(response.status).not.toBe(403);
    });
  });

  describe("PATCH /api/admin/site-config", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await patchSiteConfig(
        new Request("http://localhost/api/admin/site-config", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            origin: "https://evil.example.com",
          },
          body: JSON.stringify({ key: "test", value: "val" }),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/admin/gallery", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await postGallery(
        new Request("http://localhost/api/admin/gallery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://evil.example.com",
          },
          body: JSON.stringify({ courseId: "some-id" }),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/access-codes", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await postAccessCodes(
        new Request("http://localhost/api/access-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://evil.example.com",
          },
          body: JSON.stringify({ count: 1 }),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/access-codes/[codeId]", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await deleteAccessCode(
        new Request("http://localhost/api/access-codes/some-id", {
          method: "DELETE",
          headers: { origin: "https://evil.example.com" },
        }),
        { params: Promise.resolve({ codeId: "some-id" }) }
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/admin/generation-logs/cleanup", () => {
    it("rejects cross-origin requests with 403", async () => {
      vi.mocked(authUtils.requireOwnerFromRequest).mockResolvedValueOnce(csrfRejection());

      const response = await postCleanup(
        new Request("http://localhost/api/admin/generation-logs/cleanup", {
          method: "POST",
          headers: { origin: "https://evil.example.com" },
        })
      );

      expect(response.status).toBe(403);
    });
  });
});
