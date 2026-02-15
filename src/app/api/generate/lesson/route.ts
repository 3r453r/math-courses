export const maxDuration = 300;

import { streamObject } from "ai";
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

  const body: { lessonId?: string; courseId?: string; model?: string; weakTopics?: string[] } =
    await request.json();
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

  // Mock path — non-streaming, returns JSON immediately
  if (model === "mock") {
    const lessonContent = mockLessonContent();
    const quizContent = mockQuiz();
    await saveResults(lessonId, lessonContent, quizContent, "mock");
    return NextResponse.json({ lesson: lessonContent, quiz: quizContent });
  }

  // Real AI path — stream to keep Vercel function alive
  const modelInstance = getModelInstance(model, apiKeys);

  const prerequisiteSummaries = lesson.dependsOn
    .map((e) => `- ${e.fromLesson.title}: ${e.fromLesson.summary}`)
    .join("\n");

  const focusAreas = JSON.parse(lesson.course.focusAreas || "[]") as string[];

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

  // Stream lesson generation to keep the Vercel function alive.
  // The client reads this stream; the final line is JSON with both lesson + quiz.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Stream lesson content generation
        controller.enqueue(encoder.encode("event:status\ndata:generating_lesson\n\n"));

        const lessonStream = streamObject({
          model: modelInstance,
          schema: lessonContentSchema,
          prompt: lessonPrompt,
        });

        // Pipe partial text to keep the connection alive
        for await (const chunk of lessonStream.textStream) {
          controller.enqueue(encoder.encode(`event:chunk\ndata:${chunk.length}\n\n`));
        }

        const lessonContent = await lessonStream.object;

        // Normalize visualization specs
        if (lessonContent.sections) {
          for (const section of lessonContent.sections) {
            if (section.type === "visualization" && typeof section.spec === "string") {
              try {
                (section as Record<string, unknown>).spec = JSON.parse(section.spec);
              } catch {
                // Keep as-is
              }
            }
          }
        }

        // Step 2: Generate quiz (smaller output, uses generateObject)
        controller.enqueue(encoder.encode("event:status\ndata:generating_quiz\n\n"));

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

        // Stream quiz too to keep alive during generation
        const quizStream = streamObject({
          model: modelInstance,
          schema: quizSchema,
          prompt: quizPrompt,
        });

        for await (const chunk of quizStream.textStream) {
          controller.enqueue(encoder.encode(`event:chunk\ndata:${chunk.length}\n\n`));
        }

        const quizContent = await quizStream.object;

        // Step 3: Save to database
        controller.enqueue(encoder.encode("event:status\ndata:saving\n\n"));
        await saveResults(lessonId, lessonContent, quizContent, lessonPrompt);

        // Final event: send the complete result as JSON
        const result = JSON.stringify({ lesson: lessonContent, quiz: quizContent });
        controller.enqueue(encoder.encode(`event:result\ndata:${result}\n\n`));
        controller.close();
      } catch (err) {
        console.error("Failed to generate lesson:", err);
        // Reset lesson status
        await prisma.lesson
          .update({ where: { id: lessonId }, data: { status: "pending" } })
          .catch(() => {});
        const errorMsg = err instanceof Error ? err.message : "Failed to generate lesson";
        controller.enqueue(encoder.encode(`event:error\ndata:${JSON.stringify({ error: errorMsg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function saveResults(
  lessonId: string,
  lessonContent: Record<string, unknown>,
  quizContent: { questions: unknown[] },
  generationPrompt: string
) {
  // Deactivate existing quizzes
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

  // Save lesson content
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      contentJson: JSON.stringify(lessonContent),
      generationPrompt,
      status: "ready",
    },
  });

  // Save quiz
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
}
