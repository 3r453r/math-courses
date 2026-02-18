import "../helpers/setup";

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPreview } from "@/app/api/preview/[shareToken]/route";
import { POST as scorePreview } from "@/app/api/preview/[shareToken]/score/route";
import { GET as getGalleryStats } from "@/app/api/gallery/stats/route";
import { GET as getPublicConfig } from "@/app/api/site-config/public/route";
import { GET as getAdminConfig, PATCH as patchAdminConfig } from "@/app/api/admin/site-config/route";
import { PATCH as updateGalleryShare } from "@/app/api/admin/gallery/[shareId]/route";
import { getTestPrisma } from "../helpers/db";
import { createTestCourse, createTestLesson, createTestQuiz } from "../helpers/fixtures";
import * as authUtils from "@/lib/auth-utils";

const SAMPLE_QUESTIONS = JSON.stringify([
  {
    id: "q1",
    questionText: "What is 2+2?",
    topic: "arithmetic",
    difficulty: "easy",
    choices: [
      { id: "a", text: "3", correct: false, explanation: "Wrong" },
      { id: "b", text: "4", correct: true, explanation: "Correct" },
      { id: "c", text: "5", correct: false, explanation: "Wrong" },
    ],
  },
  {
    id: "q2",
    questionText: "What is 3+3?",
    topic: "arithmetic",
    difficulty: "easy",
    choices: [
      { id: "a", text: "5", correct: false, explanation: "Wrong" },
      { id: "b", text: "6", correct: true, explanation: "Correct" },
      { id: "c", text: "7", correct: false, explanation: "Wrong" },
    ],
  },
]);

const SAMPLE_CONTENT = JSON.stringify({
  learningObjectives: ["Learn arithmetic"],
  sections: [{ type: "text", content: "Hello world" }],
  keyTakeaways: ["Math is fun"],
});

async function createGalleryWithPreview() {
  const prisma = getTestPrisma();
  const course = await createTestCourse({ title: "Preview Course", status: "ready" });
  const lesson = await createTestLesson(course.id, {
    title: "Preview Lesson",
    orderIndex: 0,
    status: "ready",
    contentJson: SAMPLE_CONTENT,
  });
  const otherLesson = await createTestLesson(course.id, {
    title: "Locked Lesson",
    orderIndex: 1,
    status: "ready",
    contentJson: SAMPLE_CONTENT,
  });
  await createTestQuiz(lesson.id, {
    status: "ready",
    questionsJson: SAMPLE_QUESTIONS,
    questionCount: 2,
  });

  const share = await prisma.courseShare.create({
    data: {
      courseId: course.id,
      shareToken: `preview-${Date.now()}`,
      isActive: true,
      isGalleryListed: true,
      previewLessonId: lesson.id,
    },
  });

  return { course, lesson, otherLesson, share };
}

// ─── Preview API ────────────────────────────────────────────────────

describe("GET /api/preview/[shareToken]", () => {
  it("returns preview data for valid gallery course with preview", async () => {
    const { share, lesson } = await createGalleryWithPreview();

    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: share.shareToken });
    const response = await getPreview(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shareToken).toBe(share.shareToken);
    expect(data.previewLessonId).toBe(lesson.id);
    expect(data.course.title).toBe("Preview Course");
    expect(data.course.lessons).toHaveLength(2);
    expect(data.previewContent).not.toBeNull();
    expect(data.previewContent.contentJson).toBe(SAMPLE_CONTENT);
    expect(data.previewContent.quiz).not.toBeNull();
    expect(data.previewContent.quiz.questionCount).toBe(2);

    // Verify non-preview lessons don't include contentJson
    for (const l of data.course.lessons) {
      expect(l.contentJson).toBeUndefined();
    }
  });

  it("returns 404 for non-existent share", async () => {
    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: "nonexistent" });
    const response = await getPreview(request, { params });
    expect(response.status).toBe(404);
  });

  it("returns 404 for non-gallery share", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Private Course", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "L", orderIndex: 0 });
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "private-share-token",
        isActive: true,
        isGalleryListed: false,
        previewLessonId: lesson.id,
      },
    });

    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: "private-share-token" });
    const response = await getPreview(request, { params });
    expect(response.status).toBe(404);
  });

  it("returns 404 for gallery share without preview lesson", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "No Preview", status: "ready" });
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "no-preview-token",
        isActive: true,
        isGalleryListed: true,
        previewLessonId: null,
      },
    });

    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: "no-preview-token" });
    const response = await getPreview(request, { params });
    expect(response.status).toBe(404);
  });

  it("returns 404 for inactive share", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Inactive", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "L", orderIndex: 0 });
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "inactive-share-token",
        isActive: false,
        isGalleryListed: true,
        previewLessonId: lesson.id,
      },
    });

    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: "inactive-share-token" });
    const response = await getPreview(request, { params });
    expect(response.status).toBe(404);
  });

  it("returns 404 for expired share", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Expired", status: "ready" });
    const lesson = await createTestLesson(course.id, { title: "L", orderIndex: 0 });
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "expired-share-token",
        isActive: true,
        isGalleryListed: true,
        previewLessonId: lesson.id,
        expiresAt: new Date("2020-01-01"),
      },
    });

    const request = new Request("http://localhost/api/preview/xxx");
    const params = Promise.resolve({ shareToken: "expired-share-token" });
    const response = await getPreview(request, { params });
    expect(response.status).toBe(404);
  });
});

// ─── Preview Quiz Score ──────────────────────────────────────────────

describe("POST /api/preview/[shareToken]/score", () => {
  it("scores quiz correctly and returns result", async () => {
    const { share } = await createGalleryWithPreview();

    const request = new Request("http://localhost/api/preview/xxx/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { q1: ["b"], q2: ["b"] } }),
    });
    const params = Promise.resolve({ shareToken: share.shareToken });
    const response = await scorePreview(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.score).toBe(1.0);
    expect(data.recommendation).toBe("advance");
    expect(data.weakTopics).toEqual([]);
  });

  it("returns correct score for partial answers", async () => {
    const { share } = await createGalleryWithPreview();

    const request = new Request("http://localhost/api/preview/xxx/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { q1: ["b"], q2: ["a"] } }),
    });
    const params = Promise.resolve({ shareToken: share.shareToken });
    const response = await scorePreview(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.score).toBe(0.5);
    expect(data.recommendation).toBe("supplement");
  });

  it("returns 404 for invalid share token", async () => {
    const request = new Request("http://localhost/api/preview/xxx/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: {} }),
    });
    const params = Promise.resolve({ shareToken: "nonexistent" });
    const response = await scorePreview(request, { params });
    expect(response.status).toBe(404);
  });

  it("returns 400 for missing answers", async () => {
    const { share } = await createGalleryWithPreview();
    const request = new Request("http://localhost/api/preview/xxx/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ shareToken: share.shareToken });
    const response = await scorePreview(request, { params });
    expect(response.status).toBe(400);
  });
});

// ─── Admin Gallery PATCH — previewLessonId ───────────────────────────

describe("PATCH /api/admin/gallery/[shareId] — preview", () => {
  it("sets previewLessonId on a gallery share", async () => {
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce({
      userId: "admin-1", role: "admin", accessStatus: "active", error: null,
    });

    const { share, lesson } = await createGalleryWithPreview();

    const request = new Request("http://localhost/api/admin/gallery/xxx", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewLessonId: lesson.id }),
    });
    const params = Promise.resolve({ shareId: share.id });
    const response = await updateGalleryShare(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.previewLessonId).toBe(lesson.id);
  });

  it("clears previewLessonId when set to null", async () => {
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce({
      userId: "admin-1", role: "admin", accessStatus: "active", error: null,
    });

    const { share } = await createGalleryWithPreview();

    const request = new Request("http://localhost/api/admin/gallery/xxx", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewLessonId: null }),
    });
    const params = Promise.resolve({ shareId: share.id });
    const response = await updateGalleryShare(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.previewLessonId).toBeNull();
  });

  it("rejects lesson that doesn't belong to the course", async () => {
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce({
      userId: "admin-1", role: "admin", accessStatus: "active", error: null,
    });

    const { share } = await createGalleryWithPreview();
    const otherCourse = await createTestCourse({ title: "Other Course" });
    const otherLesson = await createTestLesson(otherCourse.id, { title: "Other", orderIndex: 0 });

    const request = new Request("http://localhost/api/admin/gallery/xxx", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewLessonId: otherLesson.id }),
    });
    const params = Promise.resolve({ shareId: share.id });
    const response = await updateGalleryShare(request, { params });

    expect(response.status).toBe(400);
  });
});

// ─── Site Config ─────────────────────────────────────────────────────

describe("Site Config API", () => {
  it("GET /api/admin/site-config returns all configs (admin)", async () => {
    vi.mocked(authUtils.requireAdmin).mockResolvedValueOnce({
      userId: "admin-1", role: "admin", accessStatus: "active", error: null,
    });

    const prisma = getTestPrisma();
    await prisma.siteConfig.create({
      data: { key: "showGalleryStatsOnPricing", value: "true" },
    });

    const response = await getAdminConfig();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.showGalleryStatsOnPricing).toBe("true");
  });

  it("PATCH /api/admin/site-config upserts config (admin)", async () => {
    vi.mocked(authUtils.requireAdminFromRequest).mockResolvedValueOnce({
      userId: "admin-1", role: "admin", accessStatus: "active", error: null,
    });

    const request = new Request("http://localhost/api/admin/site-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "showGalleryStatsOnPricing", value: "true" }),
    });
    const response = await patchAdminConfig(request);
    expect(response.status).toBe(200);

    const prisma = getTestPrisma();
    const config = await prisma.siteConfig.findUnique({
      where: { key: "showGalleryStatsOnPricing" },
    });
    expect(config?.value).toBe("true");
  });

  it("GET /api/site-config/public returns only whitelisted keys", async () => {
    const prisma = getTestPrisma();
    await prisma.siteConfig.create({
      data: { key: "showGalleryStatsOnPricing", value: "true" },
    });
    await prisma.siteConfig.create({
      data: { key: "secretKey", value: "should-not-appear" },
    });

    const response = await getPublicConfig();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.showGalleryStatsOnPricing).toBe("true");
    expect(data.secretKey).toBeUndefined();
  });
});

// ─── Gallery Stats ───────────────────────────────────────────────────

describe("GET /api/gallery/stats", () => {
  it("returns gallery aggregate stats", async () => {
    const prisma = getTestPrisma();
    const course = await createTestCourse({ title: "Stats Course", status: "ready" });
    await prisma.courseShare.create({
      data: {
        courseId: course.id,
        shareToken: "stats-share",
        isActive: true,
        isGalleryListed: true,
      },
    });

    const response = await getGalleryStats();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.totalCourses).toBe(1);
    expect(data.totalRatings).toBe(0);
    expect(data.averageRating).toBeNull();
  });
});
