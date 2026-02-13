import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId query parameter required" },
        { status: 400 }
      );
    }

    let note = await prisma.note.findFirst({
      where: { lessonId, isScratchpad: true },
    });

    if (!note) {
      note = await prisma.note.create({
        data: { lessonId, content: "", isScratchpad: true },
      });
    }

    return NextResponse.json({
      id: note.id,
      lessonId: note.lessonId,
      content: note.content,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch scratchpad:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch scratchpad",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, content } = body as { id?: string; content?: string };

    if (!id || content === undefined) {
      return NextResponse.json(
        { error: "id and content required" },
        { status: 400 }
      );
    }

    const note = await prisma.note.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({
      id: note.id,
      lessonId: note.lessonId,
      content: note.content,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error("Failed to save scratchpad:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save scratchpad",
      },
      { status: 500 }
    );
  }
}
