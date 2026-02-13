import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { topics } = body as {
      topics?: { title: string; summary: string }[];
    };

    if (!topics || topics.length === 0) {
      return NextResponse.json(
        { error: "At least one topic is required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: { orderBy: { orderIndex: "asc" } },
        edges: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find layer-0 lessons (no incoming prerequisite edges)
    const lessonsWithIncoming = new Set(
      course.edges
        .filter((e) => e.relationship === "prerequisite")
        .map((e) => e.toLessonId)
    );
    const layerZeroLessons = course.lessons.filter(
      (l) => !lessonsWithIncoming.has(l.id)
    );

    // Shift existing lesson orderIndex values up to make room
    const shiftAmount = topics.length;
    await prisma.$transaction(
      course.lessons.map((l) =>
        prisma.lesson.update({
          where: { id: l.id },
          data: { orderIndex: l.orderIndex + shiftAmount },
        })
      )
    );

    // Create new prerequisite lessons
    const createdLessons = [];
    for (let i = 0; i < topics.length; i++) {
      const created = await prisma.lesson.create({
        data: {
          courseId,
          title: topics[i].title,
          summary: topics[i].summary,
          orderIndex: i,
          status: "pending",
          isSupplementary: false,
        },
      });
      createdLessons.push(created);
    }

    // Create edges: each new prereq lesson -> each existing layer-0 lesson
    for (const newLesson of createdLessons) {
      for (const existingLesson of layerZeroLessons) {
        await prisma.courseEdge.create({
          data: {
            courseId,
            fromLessonId: newLesson.id,
            toLessonId: existingLesson.id,
            relationship: "prerequisite",
          },
        });
      }
    }

    return NextResponse.json({ lessons: createdLessons });
  } catch (error) {
    console.error("Failed to add prerequisite lessons:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add prerequisite lessons",
      },
      { status: 500 }
    );
  }
}
