import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { mockLessonContent, mockQuiz } from "@/lib/ai/mockData";
import { lessonWithQuizSchema } from "@/lib/ai/schemas/lessonWithQuizSchema";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  let body: { lessonId?: string; courseId?: string; model?: string; weakTopics?: string[] } = {};

  try {
    body = await request.json();
    const { lessonId, courseId } = body;

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: "lessonId and courseId required" }, { status: 400 });
    }

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
      const anthropic = getAnthropicClient(apiKey);

      const prerequisiteSummaries = lesson.dependsOn
        .map((e) => `- ${e.fromLesson.title}: ${e.fromLesson.summary}`)
        .join("\n");

      const focusAreas = JSON.parse(lesson.course.focusAreas || "[]") as string[];

      let prompt = `You are an educator specializing in ${lesson.course.topic}, creating a detailed lesson with an accompanying quiz.

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
8. Make the content thorough but accessible - explain the "why" not just the "what".

QUIZ GUIDELINES:
After creating the lesson content, also generate 10-20 quiz questions that:
1. Directly reference definitions, theorems, and examples from the lesson content.
2. Test understanding at varying difficulty levels (easy, medium, hard).
3. Include conceptual, computational, and application questions.
4. Tag each question with the specific sub-topic it covers.
5. Provide detailed explanations for every choice (why correct or incorrect).
6. Ensure at least one question has multiple correct answers.
7. Use Markdown with LaTeX notation for all math in questions and choices.`;

      if (body.weakTopics && body.weakTopics.length > 0) {
        prompt += `\n\nIMPORTANT - QUIZ FEEDBACK:
The student previously studied this lesson and took a quiz. They scored poorly on these topics:
${body.weakTopics.map((t) => `- ${t}`).join("\n")}

Please REGENERATE the lesson with EXTRA emphasis on these weak areas:
- Add more detailed explanations and intuition for the weak topics
- Include additional worked examples specifically targeting these areas
- Add more practice exercises for the weak topics
- Consider alternative explanations or approaches that might resonate better

For the quiz: include a higher proportion of questions (at least 50%) targeting these weak topics: ${body.weakTopics.join(", ")}`;
      }

      const { object } = await generateObject({
        model: anthropic(model),
        schema: lessonWithQuizSchema,
        prompt,
      });
      lessonContent = object.lesson;
      quizContent = object.quiz;
      generationPrompt = prompt;
    }

    // Delete any existing quiz for this lesson (handles regeneration)
    await prisma.quiz.deleteMany({
      where: { lessonId },
    });

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
