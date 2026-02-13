import { generateObject } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { mockLessonContent } from "@/lib/ai/mockData";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

// Lesson content Zod schema for structured AI output
const lessonContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  sections: z.array(
    z.union([
      z.object({
        type: z.literal("text"),
        content: z.string().describe("Markdown with LaTeX ($...$ for inline, $$...$$ for display)"),
      }),
      z.object({
        type: z.literal("math"),
        latex: z.string().describe("Display LaTeX expression"),
        explanation: z.string().optional(),
      }),
      z.object({
        type: z.literal("definition"),
        term: z.string(),
        definition: z.string().describe("Markdown+LaTeX"),
        intuition: z.string().optional(),
      }),
      z.object({
        type: z.literal("theorem"),
        name: z.string(),
        statement: z.string().describe("Markdown+LaTeX"),
        proof: z.string().optional(),
        intuition: z.string().optional(),
      }),
      z.object({
        type: z.literal("visualization"),
        vizType: z.enum([
          "function_plot",
          "parametric_plot",
          "vector_field",
          "geometry",
          "3d_surface",
          "manifold",
          "tangent_space",
          "coordinate_transform",
        ]),
        spec: z.object({
          xRange: z.tuple([z.number(), z.number()]).optional(),
          yRange: z.tuple([z.number(), z.number()]).optional(),
          functions: z
            .array(
              z.object({
                expression: z.string().describe("JavaScript Math expression of x"),
                color: z.string().optional(),
                label: z.string().optional(),
              })
            )
            .optional(),
          parametricSurface: z
            .object({
              xExpr: z.string(),
              yExpr: z.string(),
              zExpr: z.string(),
              uRange: z.tuple([z.number(), z.number()]),
              vRange: z.tuple([z.number(), z.number()]),
            })
            .optional(),
          points: z
            .array(
              z.object({
                x: z.number(),
                y: z.number(),
                label: z.string().optional(),
              })
            )
            .optional(),
          vectors: z
            .array(
              z.object({
                origin: z.tuple([z.number(), z.number()]),
                direction: z.tuple([z.number(), z.number()]),
                color: z.string().optional(),
                label: z.string().optional(),
              })
            )
            .optional(),
        }),
        caption: z.string(),
        interactionHint: z.string().optional(),
      }),
    ])
  ),
  workedExamples: z.array(
    z.object({
      title: z.string(),
      problemStatement: z.string(),
      steps: z.array(
        z.object({
          description: z.string(),
          math: z.string().optional(),
        })
      ),
      finalAnswer: z.string(),
    })
  ),
  practiceExercises: z.array(
    z.object({
      id: z.string(),
      problemStatement: z.string(),
      hints: z.array(z.string()),
      solution: z.string(),
      answerType: z.enum(["free_response", "multiple_choice", "numeric"]),
      expectedAnswer: z.string().optional(),
      choices: z
        .array(
          z.object({
            label: z.string(),
            correct: z.boolean(),
          })
        )
        .optional(),
    })
  ),
  keyTakeaways: z.array(z.string()),
});

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

    let content;
    let generationPrompt = "mock";
    if (model === "mock") {
      content = mockLessonContent();
    } else {
      const anthropic = getAnthropicClient(apiKey);

      const prerequisiteSummaries = lesson.dependsOn
        .map((e) => `- ${e.fromLesson.title}: ${e.fromLesson.summary}`)
        .join("\n");

      const focusAreas = JSON.parse(lesson.course.focusAreas || "[]") as string[];

      let prompt = `You are a mathematics educator creating a detailed lesson.

LESSON: ${lesson.title}
SUMMARY: ${lesson.summary}
COURSE: ${lesson.course.title} - ${lesson.course.topic}
DIFFICULTY: ${lesson.course.difficulty}
FOCUS AREAS: ${focusAreas.join(", ") || "General coverage"}

${prerequisiteSummaries ? `PREREQUISITES COMPLETED:\n${prerequisiteSummaries}` : "This is a starting lesson with no prerequisites."}

CONTENT GUIDELINES:
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
        prompt += `\n\nIMPORTANT - QUIZ FEEDBACK:
The student previously studied this lesson and took a quiz. They scored poorly on these topics:
${body.weakTopics.map((t) => `- ${t}`).join("\n")}

Please REGENERATE the lesson with EXTRA emphasis on these weak areas:
- Add more detailed explanations and intuition for the weak topics
- Include additional worked examples specifically targeting these areas
- Add more practice exercises for the weak topics
- Consider alternative explanations or approaches that might resonate better`;
      }

      const { object } = await generateObject({
        model: anthropic(model),
        schema: lessonContentSchema,
        prompt,
      });
      content = object;
      generationPrompt = prompt;
    }

    // Save generated content
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        contentJson: JSON.stringify(content),
        generationPrompt,
        status: "ready",
      },
    });

    return NextResponse.json(content);
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
