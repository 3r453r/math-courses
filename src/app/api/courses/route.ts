import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { lessons: true } },
      },
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, topic, focusAreas, targetLessonCount, difficulty, language } = body;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        topic,
        focusAreas: JSON.stringify(focusAreas || []),
        targetLessonCount: targetLessonCount || 10,
        difficulty: difficulty || "intermediate",
        language: language || "en",
        status: "draft",
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Failed to create course:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
