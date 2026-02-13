import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { courseStructureSchema } from "@/lib/ai/schemas/courseSchema";
import { buildCourseStructurePrompt } from "@/lib/ai/prompts/courseStructure";
import { mockCourseStructure } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: {
    courseId?: string;
    topic?: string;
    description?: string;
    focusAreas?: string[];
    lessonCount?: number;
    difficulty?: string;
    model?: string;
  } = {};

  try {
    body = await request.json();
    const { courseId, topic, description, focusAreas, lessonCount, difficulty } = body;

    // Update course status to generating
    if (courseId) {
      await prisma.course.update({
        where: { id: courseId },
        data: { status: "generating" },
      });
    }

    const model = body.model || MODELS.generation;

    let courseStructure;
    if (model === "mock") {
      courseStructure = mockCourseStructure();
    } else {
      const anthropic = getAnthropicClient(apiKey);

      const systemPrompt = buildCourseStructurePrompt({
        topic: topic || "",
        description: description || "",
        focusAreas: focusAreas || [],
        lessonCount,
        difficulty: difficulty || "intermediate",
      });

      const { object } = await generateObject({
        model: anthropic(model),
        schema: courseStructureSchema,
        prompt: systemPrompt,
      });
      courseStructure = object;
    }

    // If we have a courseId, save the generated structure to the database
    if (courseId) {
      // Update course with generated title/description
      await prisma.course.update({
        where: { id: courseId },
        data: {
          title: courseStructure.title,
          description: courseStructure.description,
          status: "ready",
        },
      });

      // Create lessons
      const createdLessons = [];
      for (const lesson of courseStructure.lessons) {
        const created = await prisma.lesson.create({
          data: {
            courseId,
            title: lesson.title,
            summary: lesson.summary,
            orderIndex: lesson.orderIndex,
            status: "pending",
          },
        });
        createdLessons.push(created);
      }

      // Create edges (map orderIndex to actual lesson IDs)
      const indexToId = new Map<number, string>();
      for (const lesson of createdLessons) {
        indexToId.set(lesson.orderIndex, lesson.id);
      }

      for (const edge of courseStructure.edges) {
        const fromId = indexToId.get(edge.from);
        const toId = indexToId.get(edge.to);
        if (fromId && toId) {
          await prisma.courseEdge.create({
            data: {
              courseId,
              fromLessonId: fromId,
              toLessonId: toId,
              relationship: edge.relationship,
            },
          });
        }
      }
    }

    return NextResponse.json(courseStructure);
  } catch (error) {
    console.error("Failed to generate course structure:", error);
    // Reset course status on failure using the already-parsed body
    if (body.courseId) {
      await prisma.course.update({
        where: { id: body.courseId },
        data: { status: "draft" },
      }).catch(() => {});
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate course structure" },
      { status: 500 }
    );
  }
}
