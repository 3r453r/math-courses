import { prisma } from "@/lib/db";
import { getAuthUserFromRequest, verifyCourseOwnership } from "@/lib/auth-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const updateNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(100000).optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, {
  message: "title or content required",
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ courseId: string; noteId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const { courseId, noteId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;
    const { data: body, error: parseError } = await parseBody(request, updateNoteSchema);
    if (parseError) return parseError;
    const { title, content } = body;

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      type: updated.lessonId ? "lesson" : "custom",
      lessonId: updated.lessonId,
      title: updated.title ?? "Untitled",
      content: updated.content,
      orderIndex: updated.orderIndex,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to update notebook page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notebook page" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string; noteId: string }> }
) {
  const { userId, error: authError } = await getAuthUserFromRequest(request);
  if (authError) return authError;

  try {
    const { courseId, noteId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Only allow deleting custom pages, not lesson scratchpads
    if (note.lessonId) {
      return NextResponse.json(
        { error: "Cannot delete lesson scratchpad pages" },
        { status: 400 }
      );
    }

    await prisma.note.delete({ where: { id: noteId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete notebook page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete notebook page" },
      { status: 500 }
    );
  }
}
