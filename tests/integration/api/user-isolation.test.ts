import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/courses/route";

function makeGetRequest() {
  return new NextRequest(new URL("http://localhost/api/courses"));
}
import {
  GET as GET_BY_ID,
} from "@/app/api/courses/[courseId]/route";
import { createTestCourse, createTestUser, TEST_USER_ID } from "../helpers/fixtures";
import { getTestPrisma } from "../helpers/db";
import * as authUtils from "@/lib/auth-utils";

const USER_B_ID = "user-b-id";

describe("multi-user data isolation", () => {
  it("GET /api/courses only returns courses for the authenticated user", async () => {
    // Create User B
    await createTestUser({ id: USER_B_ID, email: "userb@example.com", name: "User B" });

    // Create courses for each user
    await createTestCourse({ title: "User A Course", userId: TEST_USER_ID });
    await createTestCourse({ title: "User B Course", userId: USER_B_ID });

    // Default auth mock returns TEST_USER_ID (User A)
    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(data.courses).toHaveLength(1);
    expect(data.courses[0].title).toBe("User A Course");
  });

  it("GET /api/courses/[courseId] returns 404 for another user's course", async () => {
    await createTestUser({ id: USER_B_ID, email: "userb@example.com", name: "User B" });
    const userBCourse = await createTestCourse({ title: "User B Course", userId: USER_B_ID });

    // Auth mock returns TEST_USER_ID — trying to access User B's course
    const response = await GET_BY_ID(
      new Request(`http://localhost:3000/api/courses/${userBCourse.id}`),
      { params: Promise.resolve({ courseId: userBCourse.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("user can only see their own courses even when multiple users have courses", async () => {
    await createTestUser({ id: USER_B_ID, email: "userb@example.com", name: "User B" });

    await createTestCourse({ title: "A1", userId: TEST_USER_ID });
    await createTestCourse({ title: "A2", userId: TEST_USER_ID });
    await createTestCourse({ title: "B1", userId: USER_B_ID });

    // Total courses in DB should be 3
    const prisma = getTestPrisma();
    const totalCourses = await prisma.course.count();
    expect(totalCourses).toBe(3);

    // But GET /api/courses should return only 2 for User A
    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.courses).toHaveLength(2);
    expect(data.courses.map((c: { title: string }) => c.title).sort()).toEqual(["A1", "A2"]);
  });

  it("switching authenticated user changes which courses are visible", async () => {
    await createTestUser({ id: USER_B_ID, email: "userb@example.com", name: "User B" });

    await createTestCourse({ title: "User A Course", userId: TEST_USER_ID });
    await createTestCourse({ title: "User B Course", userId: USER_B_ID });

    // As User A — should see only User A's course
    const responseA = await GET(makeGetRequest());
    const dataA = await responseA.json();
    expect(dataA.courses).toHaveLength(1);
    expect(dataA.courses[0].title).toBe("User A Course");

    // Switch to User B
    vi.mocked(authUtils.getAuthUser).mockResolvedValueOnce({ userId: USER_B_ID, role: "user", accessStatus: "active", error: null });
    vi.mocked(authUtils.verifyCourseOwnership).mockImplementationOnce(async (courseId: string) => {
      const prisma = getTestPrisma();
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, userId: true },
      });
      if (!course || course.userId !== USER_B_ID) {
        const { NextResponse } = await import("next/server");
        return { course: null, error: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
      }
      return { course, error: null };
    });

    const responseB = await GET(makeGetRequest());
    const dataB = await responseB.json();
    expect(dataB.courses).toHaveLength(1);
    expect(dataB.courses[0].title).toBe("User B Course");
  });
});
