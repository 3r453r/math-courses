import { prisma } from "@/lib/db";
import { getAuthUser, getAuthUserFromRequest } from "@/lib/auth-utils";
import { NextResponse } from "next/server";

/**
 * GET /api/user/notifications — Returns unread notifications for the current user
 */
export async function GET() {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/**
 * PATCH /api/user/notifications — Mark notification(s) as read
 * Body: { ids: string[] } or { all: true }
 */
export async function PATCH(request: Request) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId, // ensure ownership
        },
        data: { read: true },
      });
    } else {
      return NextResponse.json({ error: "Provide ids array or all: true" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
