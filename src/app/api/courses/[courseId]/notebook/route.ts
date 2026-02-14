import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

interface NotebookPage {
  id: string;
  type: "lesson" | "custom";
  lessonId: string | null;
  title: string;
  content: string;
  orderIndex: number;
  updatedAt: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Fetch lessons with their scratchpad notes (non-empty content only)
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { orderIndex: "asc" },
      include: {
        notes: {
          where: { isScratchpad: true, content: { not: "" } },
          take: 1,
        },
      },
    });

    // Fetch custom notebook pages (notes with courseId, no lessonId)
    const customPages = await prisma.note.findMany({
      where: { courseId, lessonId: null },
      orderBy: { orderIndex: "asc" },
    });

    // Build lesson pages (only those with non-empty scratchpad)
    const lessonPages: NotebookPage[] = lessons
      .filter((l) => l.notes.length > 0)
      .map((l) => ({
        id: l.notes[0].id,
        type: "lesson" as const,
        lessonId: l.id,
        title: l.title,
        content: l.notes[0].content,
        orderIndex: l.orderIndex,
        updatedAt: l.notes[0].updatedAt.toISOString(),
      }));

    // Build custom pages
    const customNotebookPages: NotebookPage[] = customPages.map((n) => ({
      id: n.id,
      type: "custom" as const,
      lessonId: null,
      title: n.title ?? "Untitled",
      content: n.content,
      orderIndex: n.orderIndex,
      updatedAt: n.updatedAt.toISOString(),
    }));

    // Interleave: merge by orderIndex
    const allPages = [...lessonPages, ...customNotebookPages].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );

    return NextResponse.json({ pages: allPages });
  } catch (error) {
    console.error("Failed to fetch notebook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notebook" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { title, orderIndex } = body as { title?: string; orderIndex?: number };

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const note = await prisma.note.create({
      data: {
        courseId,
        title: title ?? "Untitled",
        content: "",
        isScratchpad: false,
        orderIndex: orderIndex ?? 0,
      },
    });

    return NextResponse.json({
      id: note.id,
      type: "custom",
      lessonId: null,
      title: note.title,
      content: note.content,
      orderIndex: note.orderIndex,
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create notebook page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create notebook page" },
      { status: 500 }
    );
  }
}
