import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type AuthResult =
  | { userId: string; role: string; accessStatus: string; error: null }
  | { userId: null; role: null; accessStatus: null; error: NextResponse };

type AuthResultAnyStatus =
  | { userId: string; role: string; accessStatus: string; error: null }
  | { userId: null; role: null; accessStatus: null; error: NextResponse };

const DEV_USER_EMAIL = "dev@localhost";

/**
 * Get the authenticated user's ID from the session.
 * Requires accessStatus === "active" — returns 403 for pending/suspended users.
 * In dev bypass mode, auto-creates/returns a default dev user with active status.
 */
export async function getAuthUser(): Promise<AuthResult> {
  const result = await getAuthUserAnyStatus();
  if (result.error) return result;

  if (result.accessStatus !== "active") {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json(
        { error: "Access required", accessStatus: result.accessStatus },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Get the authenticated user regardless of access status.
 * Use for routes accessible to pending users (redeem, profile, payment).
 */
export async function getAuthUserAnyStatus(): Promise<AuthResultAnyStatus> {
  // Dev bypass: auto-authenticate with a default dev user
  if (process.env.AUTH_DEV_BYPASS === "true") {
    let user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEV_USER_EMAIL,
          name: "Dev User",
          role: "admin",
          emailVerified: new Date(),
          accessStatus: "active",
          accessGrantedAt: new Date(),
          accessSource: "admin_grant",
        },
      });
    }
    return { userId: user.id, role: user.role, accessStatus: user.accessStatus, error: null };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, accessStatus: true },
  });

  if (!user) {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json({ error: "User not found" }, { status: 401 }),
    };
  }

  return {
    userId: session.user.id,
    role: user.role,
    accessStatus: user.accessStatus,
    error: null,
  };
}

/**
 * Check that the current user is an admin.
 * Returns 403 if not admin, 401 if not authenticated.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await getAuthUser();
  if (result.error) return result;

  if (!["admin", "owner"].includes(result.role)) {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Check that the current user is an owner.
 * Returns 403 if not owner, 401 if not authenticated.
 */
export async function requireOwner(): Promise<AuthResult> {
  const result = await getAuthUser();
  if (result.error) return result;

  if (result.role !== "owner") {
    return {
      userId: null,
      role: null,
      accessStatus: null,
      error: NextResponse.json({ error: "Owner access required" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Verify that a course belongs to the given user.
 * Returns the course if owned, or a 404 NextResponse if not.
 */
export async function verifyCourseOwnership(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, userId: true },
  });
  if (!course || course.userId !== userId) {
    return { course: null, error: NextResponse.json({ error: "Course not found" }, { status: 404 }) };
  }
  return { course, error: null };
}

/**
 * Verify that a lesson belongs to a course owned by the given user.
 * Returns the lesson (with courseId) if owned, or a 404 NextResponse if not.
 */
export async function verifyLessonOwnership(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, course: { select: { userId: true } } },
  });
  if (!lesson || lesson.course.userId !== userId) {
    return { lesson: null, error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) };
  }
  return { lesson, error: null };
}
