export const maxDuration = 300;

import { generateObject, NoObjectGeneratedError } from "ai";
import { getApiKeysFromRequest, getModelInstance, getProviderOptions, hasAnyApiKey, MODELS, createRepairFunction } from "@/lib/ai/client";
import { mockLessonContent } from "@/lib/ai/mockData";
import { lessonContentSchema, type LessonContentOutput } from "@/lib/ai/schemas/lessonSchema";
import { buildLanguageInstruction } from "@/lib/ai/prompts/languageInstruction";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getCheapestModel, repackWithAI, tryCoerceAndValidate } from "@/lib/ai/repairSchema";
import { validateAndRepairVisualizations } from "@/lib/content/vizValidation";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { lessonId?: string; courseId?: string; model?: string; weakTopics?: string[] } = {};

  try {
    body = await request.json();
    const { lessonId, courseId } = body;

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: "lessonId and courseId required" }, { status: 400 });
    }

    // Verify course ownership
    const { error: ownershipError } = await verifyCourseOwnership(courseId, userId);
    if (ownershipError) return ownershipError;

    // Get lesson and course info
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: true,
        dependsOn: {
          include: { fromLesson: true },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Update status
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { status: "generating" },
    });

    const model = body.model || MODELS.generation;

    let lessonContent;
    let generationPrompt = "mock";
    let vizWarnings: string[] = [];
    if (model === "mock") {
      lessonContent = mockLessonContent();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      const prerequisiteSummaries = lesson.dependsOn
        .map((e) => `- ${e.fromLesson.title}: ${e.fromLesson.summary}`)
        .join("\n");

      const focusAreas = JSON.parse(lesson.course.focusAreas || "[]") as string[];

      let prompt = `You are an educator specializing in ${lesson.course.topic}, creating a detailed lesson.

LESSON: ${lesson.title}
SUMMARY: ${lesson.summary}
COURSE: ${lesson.course.title} - ${lesson.course.topic}
DIFFICULTY: ${lesson.course.difficulty}
FOCUS AREAS: ${focusAreas.join(", ") || "General coverage"}

${prerequisiteSummaries ? `PREREQUISITES COMPLETED:\n${prerequisiteSummaries}` : "This is a starting lesson with no prerequisites."}
${lesson.course.contextDoc ? `\nCOURSE CONTEXT DOCUMENT:\n${lesson.course.contextDoc}\n\nFollow the notation conventions, pedagogical approach, and style guidelines above when generating this lesson.\n` : ""}

LESSON CONTENT GUIDELINES:
1. Use Markdown with LaTeX for all mathematical notation.
   - Inline math: $...$
   - Display math: $$...$$
2. Build intuition BEFORE formalism. Start with a motivating example or real-world connection, then introduce formal definitions.
3. Include at least ONE visualization section. Use JavaScript Math syntax (Math.sin, Math.pow, etc.) for expressions. IMPORTANT: function_plot only supports single-variable functions of x (e.g. Math.pow(x,2)). For 2D vector fields F(x,y), use vector_field with fieldFunction: '[dx_expr, dy_expr]'. For surfaces z=f(u,v), use 3d_surface.
4. Include at least ONE worked example with detailed step-by-step solution.
5. Include at least TWO practice exercises with hints and solutions.
6. For practice exercises: mirror the worked example pattern but change the specific values.
7. Aim for 8-15 sections of varied types (text, math, definition, theorem, visualization).
8. Make the content thorough but accessible - explain the "why" not just the "what".`;

      if (body.weakTopics && body.weakTopics.length > 0) {
        prompt += `\n\nIMPORTANT - WEAK AREAS FEEDBACK:
The student previously studied this lesson and scored poorly on these topics:
${body.weakTopics.map((t) => `- ${t}`).join("\n")}

Please REGENERATE the lesson with EXTRA emphasis on these weak areas:
- Add more detailed explanations and intuition for the weak topics
- Include additional worked examples specifically targeting these areas
- Add more practice exercises for the weak topics
- Consider alternative explanations or approaches that might resonate better`;
      }

      prompt += buildLanguageInstruction(lesson.course.language);

      const t0 = Date.now();
      console.log(`[lesson-gen] Starting lesson generation for "${lesson.title}" with model ${model}`);
      try {
        const { object } = await generateObject({
          model: modelInstance,
          schema: lessonContentSchema,
          prompt,
          providerOptions: getProviderOptions(model),
          experimental_repairText: createRepairFunction(lessonContentSchema),
        });
        lessonContent = object;
      } catch (genErr) {
        if (NoObjectGeneratedError.isInstance(genErr) && genErr.text) {
          console.log(`[lesson-gen] Schema mismatch, attempting recovery...`);
          // Try direct coercion on the raw text
          try {
            const parsed = JSON.parse(genErr.text);
            const coerced = tryCoerceAndValidate(parsed, lessonContentSchema);
            if (coerced) {
              console.log(`[lesson-gen] Direct coercion succeeded`);
              lessonContent = coerced;
            }
          } catch { /* not valid JSON */ }

          // Layer 2: AI repack with cheapest model
          if (!lessonContent) {
            const cheapModel = getCheapestModel(apiKeys);
            if (cheapModel) {
              console.log(`[lesson-gen] Attempting AI repack with ${cheapModel}`);
              const repacked = await repackWithAI(genErr.text, lessonContentSchema, apiKeys, cheapModel);
              if (repacked) {
                console.log(`[lesson-gen] AI repack succeeded`);
                lessonContent = repacked as LessonContentOutput;
              }
            }
          }

          if (!lessonContent) throw genErr;
        } else {
          throw genErr;
        }
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[lesson-gen] Lesson generation completed in ${elapsed}s`);
      generationPrompt = prompt;

      // Normalize: AI returns visualization spec as JSON string, parse to object
      if (lessonContent.sections) {
        for (const section of lessonContent.sections) {
          if (section.type === "visualization" && typeof section.spec === "string") {
            try {
              (section as Record<string, unknown>).spec = JSON.parse(section.spec);
            } catch {
              // Keep as-is if not valid JSON
            }
          }
        }
      }

    }

    // Validate visualization expressions and remove malformed ones
    if (lessonContent.sections) {
      const vizResult = validateAndRepairVisualizations(
        lessonContent.sections as { type: string; vizType?: string; spec?: unknown }[]
      );
      lessonContent.sections = vizResult.sections as typeof lessonContent.sections;
      vizWarnings = vizResult.warnings;
      if (vizWarnings.length > 0) {
        console.log(`[lesson-gen] Visualization warnings:`, vizWarnings);
      }
    }

    // Deactivate existing quizzes so quiz generation creates a fresh one
    await prisma.quiz.updateMany({
      where: { lessonId, isActive: true },
      data: { isActive: false },
    });

    // Save generated lesson content
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        contentJson: JSON.stringify(lessonContent),
        generationPrompt,
        status: "ready",
      },
    });

    return NextResponse.json({
      lesson: lessonContent,
      ...(vizWarnings.length > 0 && { warnings: vizWarnings }),
    });
  } catch (error) {
    console.error("Failed to generate lesson:", error);
    if (body.lessonId) {
      await prisma.lesson
        .update({
          where: { id: body.lessonId },
          data: { status: "pending" },
        })
        .catch(() => {});
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
