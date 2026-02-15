export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction } from "@/lib/ai/client";
import { courseStructureSchema, type CourseStructureOutput } from "@/lib/ai/schemas/courseSchema";
import { buildCourseStructurePrompt } from "@/lib/ai/prompts/courseStructure";
import { mockCourseStructure } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate } from "@/lib/ai/repairSchema";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
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

    // Verify course ownership if courseId provided
    if (courseId) {
      const { error: ownershipError } = await verifyCourseOwnership(courseId, userId);
      if (ownershipError) return ownershipError;
    }

    // Update course status to generating
    if (courseId) {
      await prisma.course.update({
        where: { id: courseId },
        data: { status: "generating" },
      });
    }

    // Get the course language (set at creation time)
    let courseLanguage = "en";
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { language: true } });
      courseLanguage = course?.language ?? "en";
    }

    const model = body.model || MODELS.generation;

    let courseStructure;
    if (model === "mock") {
      courseStructure = mockCourseStructure();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      const systemPrompt = buildCourseStructurePrompt({
        topic: topic || "",
        description: description || "",
        focusAreas: focusAreas || [],
        lessonCount,
        difficulty: difficulty || "intermediate",
        language: courseLanguage,
      });

      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: courseStructureSchema,
          prompt: systemPrompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(courseStructureSchema),
        });
        courseStructure = object;
      } catch (genErr) {
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[course-gen] Schema mismatch, attempting recovery...`);
          try {
            const parsed = JSON.parse(genErr.text);
            const coerced = tryCoerceAndValidate(parsed, courseStructureSchema);
            if (coerced) {
              console.log(`[course-gen] Direct coercion succeeded`);
              courseStructure = coerced;
            }
          } catch { /* not valid JSON */ }

          if (!courseStructure) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[course-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, courseStructureSchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[course-gen] AI repack succeeded`);
                courseStructure = repacked as CourseStructureOutput;
              }
            }
          }

          if (!courseStructure) throw genErr;
        } else {
          throw genErr;
        }
      }
    }

    // If we have a courseId, save the generated structure to the database
    if (courseId) {
      // Update course with generated title/description/contextDoc
      await prisma.course.update({
        where: { id: courseId },
        data: {
          title: courseStructure.title,
          description: courseStructure.description,
          subject: courseStructure.subject,
          contextDoc: courseStructure.contextDoc,
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
            weight: lesson.weight ?? 1.0,
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
