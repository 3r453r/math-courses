import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGallery } from "@/app/api/gallery/route";
import { POST as rateCourse } from "@/app/api/gallery/[shareToken]/rate/route";
import { GET as getAdminGallery, POST as createAdminGalleryListing } from "@/app/api/admin/gallery/route";
import { PATCH as updateGalleryShare } from "@/app/api/admin/gallery/[shareId]/route";
import { getTestPrisma } from "../helpers/db";
import { createTestCourse, createTestLesson, TEST_USER_ID } from "../helpers/fixtures";
import * as authUtils from "@/lib/auth-utils";

async function createGalleryListing(courseId: string) {
  const prisma = getTestPrisma();
  return prisma.courseShare.create({
    data: {
      courseId,
      shareToken: `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isActive: true,
      isGalleryListed: true,
      tags: JSON.stringify(["math", "calculus"]),
    },
  });
}

async function createShareLink(courseId: string) {
  const prisma = getTestPrisma();
  return prisma.courseShare.create({
    data: {
      courseId,
      shareToken: `share-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isActive: true,
    },
  });
}

describe("gallery API", () => {
  it("GET /api/gallery returns gallery-listed courses", async () => {
    const course = await createTestCourse({ title: "Gallery Course", status: "ready" });
    await createGalleryListing(course.id);

    // Also create a non-gallery share (should NOT appear)
    const prisma = getTestPrisma();
    await prisma.courseShare.create({
      data: { courseId: course.id, shareToken: "private-share", isActive: true },
    });

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery?page=1&limit=10")
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].course.title).toBe("Gallery Course");
    expect(data.total).toBe(1);
  });

  it("GET /api/gallery supports search filter", async () => {
    await createTestCourse({ title: "Linear Algebra", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );
    await createTestCourse({ title: "Organic Chemistry", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery?search=Algebra")
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].course.title).toBe("Linear Algebra");
  });

  it("GET /api/gallery returns filter options with languages", async () => {
    const course = await createTestCourse({ title: "Filter Test", topic: "Physics", difficulty: "advanced", language: "pl", status: "ready" });
    await createGalleryListing(course.id);

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery")
    );

    const data = await response.json();
    expect(data.filters.languages).toContain("pl");
    expect(data.filters.difficulties).toContain("advanced");
  });

  it("GET /api/gallery filters by subject", async () => {
    await createTestCourse({ title: "Math Course", subject: "Mathematics", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );
    await createTestCourse({ title: "Physics Course", subject: "Physics", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery?subject=Physics")
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].course.title).toBe("Physics Course");
  });

  it("GET /api/gallery filters by language", async () => {
    await createTestCourse({ title: "English Course", language: "en", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );
    await createTestCourse({ title: "Polish Course", language: "pl", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery?language=pl")
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].course.title).toBe("Polish Course");
  });

  it("GET /api/gallery returns subjects in filter options", async () => {
    await createTestCourse({ title: "CS Course", subject: "Computer Science", status: "ready" }).then(
      (c) => createGalleryListing(c.id)
    );

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery")
    );

    const data = await response.json();
    expect(data.filters.subjects).toContain("Computer Science");
  });
});

describe("gallery rating", () => {
  it("creates a rating and updates star count", async () => {
    const course = await createTestCourse({ title: "Rated Course", status: "ready" });
    const share = await createGalleryListing(course.id);

    const response = await rateCourse(
      new Request("http://localhost/api/gallery/x/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4 }),
      }),
      { params: Promise.resolve({ shareToken: share.shareToken }) }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.totalRatings).toBe(1);
    expect(data.averageRating).toBe(4);

    // Verify denormalized star count
    const prisma = getTestPrisma();
    const updated = await prisma.courseShare.findUnique({ where: { id: share.id } });
    expect(updated?.starCount).toBe(1);
  });

  it("rejects invalid rating values", async () => {
    const course = await createTestCourse({ title: "Bad Rating", status: "ready" });
    const share = await createGalleryListing(course.id);

    const response = await rateCourse(
      new Request("http://localhost/api/gallery/x/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 6 }),
      }),
      { params: Promise.resolve({ shareToken: share.shareToken }) }
    );

    expect(response.status).toBe(400);
  });

  it("rejects rating for non-gallery share", async () => {
    const course = await createTestCourse({ title: "Non-gallery", status: "ready" });
    const prisma = getTestPrisma();
    const share = await prisma.courseShare.create({
      data: { courseId: course.id, shareToken: "nongallery-share", isActive: true },
    });

    const response = await rateCourse(
      new Request("http://localhost/api/gallery/x/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      }),
      { params: Promise.resolve({ shareToken: share.shareToken }) }
    );

    expect(response.status).toBe(404);
  });
});

describe("admin gallery management", () => {
  beforeEach(() => {
    vi.mocked(authUtils.requireAdmin).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "admin",
      accessStatus: "active",
      error: null,
    });
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "admin",
      accessStatus: "active",
      error: null,
    });
  });

  it("GET /api/admin/gallery returns all courses (not just shares)", async () => {
    // Create a course WITHOUT any share link
    const course = await createTestCourse({ title: "No Share Course", status: "ready" });
    await createTestLesson(course.id, { status: "ready", contentJson: "{}" });

    // Create a course WITH a share link
    const course2 = await createTestCourse({ title: "Has Share Course", status: "ready" });
    await createTestLesson(course2.id, { status: "ready", contentJson: "{}" });
    await createShareLink(course2.id);

    const response = await getAdminGallery();

    expect(response.status).toBe(200);
    const data = await response.json();

    // Response should include role and courses array
    expect(data.role).toBeDefined();
    const courses = data.courses;

    // Both courses should appear
    const titles = courses.map((c: { title: string }) => c.title);
    expect(titles).toContain("No Share Course");
    expect(titles).toContain("Has Share Course");

    // Course with share should have shares array populated
    const hasShareCourse = courses.find((c: { title: string }) => c.title === "Has Share Course");
    expect(hasShareCourse.shares.length).toBe(1);

    // Course without share should have empty shares array
    const noShareCourse = courses.find((c: { title: string }) => c.title === "No Share Course");
    expect(noShareCourse.shares.length).toBe(0);
  });

  it("GET /api/admin/gallery includes eligibility info", async () => {
    const course = await createTestCourse({ title: "Eligibility Test", status: "ready" });
    await createTestLesson(course.id, { status: "ready", contentJson: "{}" });
    await createTestLesson(course.id, { status: "pending" }); // not generated

    const response = await getAdminGallery();
    const data = await response.json();

    const testCourse = data.courses.find((c: { title: string }) => c.title === "Eligibility Test");
    expect(testCourse.eligibility.isEligible).toBe(false);
    expect(testCourse.eligibility.totalLessons).toBe(2);
    expect(testCourse.eligibility.generatedLessons).toBe(1);
  });

  it("POST /api/admin/gallery auto-creates share and gallery listing", async () => {
    const course = await createTestCourse({ title: "Auto Share", status: "ready" });
    await createTestLesson(course.id, { status: "ready", contentJson: "{}" });

    const response = await createAdminGalleryListing(
      new Request("http://localhost/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.isGalleryListed).toBe(true);
    expect(data.shareToken).toBeTruthy();
    expect(data.courseId).toBe(course.id);
  });

  it("POST /api/admin/gallery rejects ineligible courses", async () => {
    const course = await createTestCourse({ title: "Ineligible", status: "draft" });

    const response = await createAdminGalleryListing(
      new Request("http://localhost/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      })
    );

    expect(response.status).toBe(400);
  });
});

describe("admin gallery clone conflict detection", () => {
  beforeEach(() => {
    vi.mocked(authUtils.requireAdmin).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "admin",
      accessStatus: "active",
      error: null,
    });
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValue({
      userId: TEST_USER_ID,
      role: "admin",
      accessStatus: "active",
      error: null,
    });
  });

  it("detects clone conflict when ancestor is gallery-listed", async () => {
    // Create original course with a gallery listing
    const original = await createTestCourse({ title: "Original Course", status: "ready" });
    await createTestLesson(original.id, { status: "ready", contentJson: "{}" });
    await createGalleryListing(original.id);

    // Create a clone of the original
    const clone = await createTestCourse({
      title: "Cloned Course",
      status: "ready",
      clonedFromId: original.id,
    });
    await createTestLesson(clone.id, { status: "ready", contentJson: "{}" });
    const cloneShare = await createShareLink(clone.id);

    // Try to add clone to gallery — should get conflict
    const response = await updateGalleryShare(
      new Request("http://localhost/api/admin/gallery/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGalleryListed: true }),
      }),
      { params: Promise.resolve({ shareId: cloneShare.id }) }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cloneConflict).toBe(true);
    expect(data.conflictingShare.course.title).toBe("Original Course");
  });

  it("replaces conflicting listing with cloneConflictAction: replace", async () => {
    const prisma = getTestPrisma();

    // Create original with gallery listing
    const original = await createTestCourse({ title: "Original Replace", status: "ready" });
    await createTestLesson(original.id, { status: "ready", contentJson: "{}" });
    const originalShare = await createGalleryListing(original.id);

    // Create clone
    const clone = await createTestCourse({
      title: "Clone Replace",
      status: "ready",
      clonedFromId: original.id,
    });
    await createTestLesson(clone.id, { status: "ready", contentJson: "{}" });
    const cloneShare = await createShareLink(clone.id);

    // Add clone with replace action
    const response = await updateGalleryShare(
      new Request("http://localhost/api/admin/gallery/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGalleryListed: true, cloneConflictAction: "replace" }),
      }),
      { params: Promise.resolve({ shareId: cloneShare.id }) }
    );

    expect(response.status).toBe(200);

    // Original should be delisted
    const updatedOriginal = await prisma.courseShare.findUnique({ where: { id: originalShare.id } });
    expect(updatedOriginal?.isGalleryListed).toBe(false);

    // Clone should be listed
    const updatedClone = await prisma.courseShare.findUnique({ where: { id: cloneShare.id } });
    expect(updatedClone?.isGalleryListed).toBe(true);
  });

  it("lists alongside with cloneConflictAction: add", async () => {
    const prisma = getTestPrisma();

    // Create original with gallery listing
    const original = await createTestCourse({ title: "Original Add", status: "ready" });
    await createTestLesson(original.id, { status: "ready", contentJson: "{}" });
    const originalShare = await createGalleryListing(original.id);

    // Create clone
    const clone = await createTestCourse({
      title: "Clone Add",
      status: "ready",
      clonedFromId: original.id,
    });
    await createTestLesson(clone.id, { status: "ready", contentJson: "{}" });
    const cloneShare = await createShareLink(clone.id);

    // Add clone with "add" action
    const response = await updateGalleryShare(
      new Request("http://localhost/api/admin/gallery/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGalleryListed: true, cloneConflictAction: "add" }),
      }),
      { params: Promise.resolve({ shareId: cloneShare.id }) }
    );

    expect(response.status).toBe(200);

    // Both should be listed
    const updatedOriginal = await prisma.courseShare.findUnique({ where: { id: originalShare.id } });
    expect(updatedOriginal?.isGalleryListed).toBe(true);

    const updatedClone = await prisma.courseShare.findUnique({ where: { id: cloneShare.id } });
    expect(updatedClone?.isGalleryListed).toBe(true);
  });

  it("detects clone conflict when using POST to auto-create share", async () => {
    // Create original with gallery listing
    const original = await createTestCourse({ title: "Original POST", status: "ready" });
    await createTestLesson(original.id, { status: "ready", contentJson: "{}" });
    await createGalleryListing(original.id);

    // Create a clone without any share
    const clone = await createTestCourse({
      title: "Clone POST",
      status: "ready",
      clonedFromId: original.id,
    });
    await createTestLesson(clone.id, { status: "ready", contentJson: "{}" });

    // Try to add clone via POST — should get conflict
    const response = await createAdminGalleryListing(
      new Request("http://localhost/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: clone.id }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cloneConflict).toBe(true);
    expect(data.conflictingShare.course.title).toBe("Original POST");
  });
});
