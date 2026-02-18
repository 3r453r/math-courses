import { vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import {
  setupTestDatabase,
  cleanDatabase,
  disconnectTestDatabase,
  getTestPrisma,
} from "./db";
import { TEST_USER_ID } from "./fixtures";

// Mock the Prisma singleton — use a getter so it lazily retrieves
// the client after setupTestDatabase() has initialized it
vi.mock("@/lib/db", () => ({
  get prisma() {
    return getTestPrisma();
  },
}));

// Mock auth to always return the test user
vi.mock("@/lib/auth-utils", () => ({
  getAuthUser: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, role: "user", accessStatus: "active", error: null }),
  getAuthUserFromRequest: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, role: "user", accessStatus: "active", error: null }),
  getAuthUserAnyStatus: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, role: "user", accessStatus: "active", error: null }),
  getAuthUserAnyStatusFromRequest: vi.fn().mockResolvedValue({ userId: TEST_USER_ID, role: "user", accessStatus: "active", error: null }),
  requireAdmin: vi.fn().mockImplementation(async () => {
    const { NextResponse } = await import("next/server");
    return { userId: null, role: null, accessStatus: null, error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }),
  requireOwner: vi.fn().mockImplementation(async () => {
    const { NextResponse } = await import("next/server");
    return { userId: null, role: null, accessStatus: null, error: NextResponse.json({ error: "Owner access required" }, { status: 403 }) };
  }),
  verifyCourseOwnership: vi.fn().mockImplementation(async (courseId: string) => {
    const prisma = getTestPrisma();
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, userId: true },
    });
    if (!course || course.userId !== TEST_USER_ID) {
      const { NextResponse } = await import("next/server");
      return { course: null, error: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
    }
    return { course, error: null };
  }),
  verifyLessonOwnership: vi.fn().mockImplementation(async (lessonId: string) => {
    const prisma = getTestPrisma();
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, course: { select: { userId: true } } },
    });
    if (!lesson || lesson.course.userId !== TEST_USER_ID) {
      const { NextResponse } = await import("next/server");
      return { lesson: null, error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) };
    }
    return { lesson, error: null };
  }),
}));

beforeAll(async () => {
  await setupTestDatabase();
}, 30000);

// Create the default test user before each test (needed since Course requires userId)
beforeEach(async () => {
  const prisma = getTestPrisma();
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
      accessStatus: "active",
      accessGrantedAt: new Date(),
      accessSource: "admin_grant",
    },
  });
});

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDatabase();
});
