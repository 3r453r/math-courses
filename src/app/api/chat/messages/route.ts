import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUser, verifyLessonOwnership } from "@/lib/auth-utils";

export async function GET(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lessonId");

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

  const { error: ownershipError } = await verifyLessonOwnership(lessonId, userId);
  if (ownershipError) return ownershipError;

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { lessonId, role, content } = await request.json();

    if (!lessonId || !role || !content) {
      return NextResponse.json({ error: "lessonId, role, and content required" }, { status: 400 });
    }

    const { error: ownershipError } = await verifyLessonOwnership(lessonId, userId);
    if (ownershipError) return ownershipError;

    const message = await prisma.chatMessage.create({
      data: { lessonId, role, content },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId, error: deleteAuthError } = await getAuthUser();
  if (deleteAuthError) return deleteAuthError;

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lessonId");

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

  const { error: ownershipError } = await verifyLessonOwnership(lessonId, userId);
  if (ownershipError) return ownershipError;

  try {
    await prisma.chatMessage.deleteMany({ where: { lessonId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear chat messages:", error);
    return NextResponse.json({ error: "Failed to clear messages" }, { status: 500 });
  }
}
