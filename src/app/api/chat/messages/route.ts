import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lessonId");

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

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
  try {
    const { lessonId, role, content } = await request.json();

    if (!lessonId || !role || !content) {
      return NextResponse.json({ error: "lessonId, role, and content required" }, { status: 400 });
    }

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
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get("lessonId");

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

  try {
    await prisma.chatMessage.deleteMany({ where: { lessonId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear chat messages:", error);
    return NextResponse.json({ error: "Failed to clear messages" }, { status: 500 });
  }
}
