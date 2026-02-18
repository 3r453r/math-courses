import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUser, getAuthUserFromRequest, verifyLessonOwnership } from "@/lib/auth-utils";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const updateScratchpadSchema = z.object({
  id: z.string().min(1).max(50),
  content: z.string().max(200000),
});

export async function GET(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId query parameter required" },
        { status: 400 }
      );
    }

    const { error: ownershipError } = await verifyLessonOwnership(lessonId, userId);
    if (ownershipError) return ownershipError;

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
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const { data: body, error: parseError } = await parseBody(request, updateScratchpadSchema);
    if (parseError) return parseError;

    const { id, content } = body;

    // Verify ownership through the note's lesson
    const existingNote = await prisma.note.findUnique({
      where: { id },
      select: { lessonId: true },
    });
    if (!existingNote || !existingNote.lessonId) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    const { error: ownershipError } = await verifyLessonOwnership(existingNote.lessonId, userId);
    if (ownershipError) return ownershipError;

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
