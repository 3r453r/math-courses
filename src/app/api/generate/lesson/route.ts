export const maxDuration = 300;

import { generateObject } from "ai";
import { getApiKeysFromRequest, getModelInstance, hasAnyApiKey, MODELS } from "@/lib/ai/client";
import { mockLessonContent, mockQuiz } from "@/lib/ai/mockData";
import { lessonContentSchema } from "@/lib/ai/schemas/lessonSchema";
import { quizSchema } from "@/lib/ai/schemas/quizSchema";
import { buildLanguageInstruction } from "@/lib/ai/prompts/languageInstruction";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";

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
    let quizContent;
    let generationPrompt = "mock";
    if (model === "mock") {
      lessonContent = mockLessonContent();
      quizContent = mockQuiz();
    } else {
      const modelInstance = getModelInstance(model, apiKeys);

      const prerequisiteSummaries = lesson.dependsOn
        .map((e) => `- ${e.fromLesson.title}: ${e.fromLesson.summary}`)
        .join("\n");

      const focusAreas = JSON.parse(lesson.course.focusAreas || "[]") as string[];

      // --- Step 1: Generate lesson content ---
      let lessonPrompt = `You are an educator specializing in ${lesson.course.topic}, creating a detailed lesson.

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
3. Include at least ONE visualization section. When specifying function expressions, use JavaScript Math syntax (Math.sin, Math.pow, etc.).
4. Include at least ONE worked example with detailed step-by-step solution.
5. Include at least TWO practice exercises with hints and solutions.
6. For practice exercises: mirror the worked example pattern but change the specific values.
7. Aim for 8-15 sections of varied types (text, math, definition, theorem, visualization).
8. Make the content thorough but accessible - explain the "why" not just the "what".`;

      if (body.weakTopics && body.weakTopics.length > 0) {
        lessonPrompt += `\n\nIMPORTANT - WEAK AREAS FEEDBACK:
The student previously studied this lesson and scored poorly on these topics:
${body.weakTopics.map((t) => `- ${t}`).join("\n")}

Please REGENERATE the lesson with EXTRA emphasis on these weak areas:
- Add more detailed explanations and intuition for the weak topics
- Include additional worked examples specifically targeting these areas
- Add more practice exercises for the weak topics
- Consider alternative explanations or approaches that might resonate better`;
      }

      lessonPrompt += buildLanguageInstruction(lesson.course.language);

      const { object: lessonObject } = await generateObject({
        model: modelInstance,
        schema: lessonContentSchema,
        prompt: lessonPrompt,
      });
      lessonContent = lessonObject;
      generationPrompt = lessonPrompt;

      // --- Step 2: Generate quiz based on the lesson content ---
      let quizPrompt = `You are an assessment designer for ${lesson.course.topic}, creating a quiz for a lesson that has just been generated.

LESSON TITLE: ${lesson.title}
LESSON SUMMARY: ${lesson.summary}
COURSE: ${lesson.course.title} - ${lesson.course.topic}
DIFFICULTY: ${lesson.course.difficulty}

LESSON CONTENT (generate questions that directly test this material):
${JSON.stringify(lessonContent, null, 2)}

QUIZ GUIDELINES:
1. Generate 10-20 multiple-choice questions that directly reference definitions, theorems, and examples from the lesson content above.
2. Each question should have 4-6 choices, with one or more correct answers.
3. Use Markdown with LaTeX ($...$ inline, $$...$$ display) for all math notation.
4. Test understanding at varying difficulty levels (easy, medium, hard).
5. Include conceptual, computational, and application questions.
6. Tag each question with the specific sub-topic it covers.
7. Provide detailed explanations for every choice (why correct or incorrect).
8. Ensure at least one question has multiple correct answers.
9. Each question ID should be unique (e.g., "q1", "q2", etc.).
10. Each choice ID should be unique within its question (e.g., "a", "b", "c", "d").`;

      if (body.weakTopics && body.weakTopics.length > 0) {
        quizPrompt += `\n\nIMPORTANT - WEAK AREAS:
Include a higher proportion of questions (at least 50%) targeting these weak topics: ${body.weakTopics.join(", ")}`;
      }

      quizPrompt += buildLanguageInstruction(lesson.course.language);

      const { object: quizObject } = await generateObject({
        model: modelInstance,
        schema: quizSchema,
        prompt: quizPrompt,
      });
      quizContent = quizObject;

      // Normalize: AI returns visualization spec as JSON string, parse to object
      if (lessonContent.sections) {
        for (const section of lessonContent.sections) {
          if (section.type === "visualization" && typeof section.spec === "string") {
            try {
              section.spec = JSON.parse(section.spec);
            } catch {
              // Keep as-is if not valid JSON
            }
          }
        }
      }
    }

    // Deactivate existing quizzes (preserve history instead of deleting)
    await prisma.quiz.updateMany({
      where: { lessonId, isActive: true },
      data: { isActive: false },
    });

    // Determine next generation number
    const maxGen = await prisma.quiz.aggregate({
      where: { lessonId },
      _max: { generation: true },
    });
    const nextGeneration = (maxGen._max.generation ?? 0) + 1;

    // Save generated content and quiz
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        contentJson: JSON.stringify(lessonContent),
        generationPrompt,
        status: "ready",
      },
    });

    await prisma.quiz.create({
      data: {
        lessonId,
        questionsJson: JSON.stringify(quizContent.questions),
        questionCount: quizContent.questions.length,
        status: "ready",
        generation: nextGeneration,
        isActive: true,
      },
    });

    return NextResponse.json({ lesson: lessonContent, quiz: quizContent });
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
