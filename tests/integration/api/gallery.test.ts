import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGallery } from "@/app/api/gallery/route";
import { POST as rateCourse } from "@/app/api/gallery/[shareToken]/rate/route";
import { getTestPrisma } from "../helpers/db";
import { createTestCourse } from "../helpers/fixtures";

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

  it("GET /api/gallery returns filter options", async () => {
    const course = await createTestCourse({ title: "Filter Test", topic: "Physics", difficulty: "advanced", status: "ready" });
    await createGalleryListing(course.id);

    const response = await getGallery(
      new NextRequest("http://localhost/api/gallery")
    );

    const data = await response.json();
    expect(data.filters.topics).toContain("Physics");
    expect(data.filters.difficulties).toContain("advanced");
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
