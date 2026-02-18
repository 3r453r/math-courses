export const maxDuration = 300;

import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { getApiKeysFromRequest, getModelInstance, hasAnyApiKey, MODELS } from "@/lib/ai/client";
import { buildLanguageInstruction } from "@/lib/ai/prompts/languageInstruction";
import { prisma } from "@/lib/db";
import { getAuthUser, verifyLessonOwnership } from "@/lib/auth-utils";
import { enforceRateLimit } from "@/lib/rate-limit";

const CHAT_RATE_LIMIT = {
  namespace: "chat",
  windowMs: 60_000,
  maxRequests: 30,
} as const;

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/chat",
    config: CHAT_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return new Response("API key required", { status: 401 });
  }

  const { messages: rawMessages, lessonId, model } = await request.json();

  if (!lessonId) {
    return new Response("lessonId required", { status: 400 });
  }

  // Convert UIMessage format (parts array) to CoreMessage format (content string)
  // that streamText expects. Also filter out empty assistant messages.
  type ChatRole = "system" | "user" | "assistant";
  type RawMessage = {
    role: string;
    content?: string;
    parts?: Array<{ type?: string; text?: string }>;
  };

  function isChatRole(role: string): role is ChatRole {
    return role === "system" || role === "user" || role === "assistant";
  }

  const messages = (rawMessages as RawMessage[]).reduce<ModelMessage[]>((acc, msg) => {
    if (!isChatRole(msg.role)) return acc;

    // Extract text content from UIMessage parts or use content directly
    let content: string;
    if (msg.parts) {
      content = msg.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
    } else {
      content = msg.content ?? "";
    }
    // Skip empty assistant messages
    if (msg.role === "assistant" && !content.trim()) return acc;
    acc.push({ role: msg.role, content });
    return acc;
  }, []);

  const { error: ownershipError } = await verifyLessonOwnership(lessonId, userId);
  if (ownershipError) return ownershipError;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true },
  });

  if (!lesson) {
    return new Response("Lesson not found", { status: 404 });
  }

  const lessonContent = lesson.contentJson ? JSON.parse(lesson.contentJson) : null;

  const systemPrompt = buildChatSystemPrompt({
    lessonTitle: lesson.title,
    lessonSummary: lesson.summary,
    courseTopic: lesson.course.topic,
    courseTitle: lesson.course.title,
    difficulty: lesson.course.difficulty,
    contextDoc: lesson.course.contextDoc,
    lessonContent,
    language: lesson.course.language,
  });

  const chatModelId = model || MODELS.chat;
  const modelInstance = getModelInstance(chatModelId, apiKeys);

  const result = streamText({
    model: modelInstance,
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}

function buildChatSystemPrompt(params: {
  lessonTitle: string;
  lessonSummary: string;
  courseTopic: string;
  courseTitle: string;
  difficulty: string;
  contextDoc?: string | null;
  lessonContent: Record<string, unknown> | null;
  language?: string;
}) {
  let prompt = `You are a friendly, knowledgeable tutor helping a student study the lesson "${params.lessonTitle}" in the course "${params.courseTitle}" (topic: ${params.courseTopic}, difficulty: ${params.difficulty}).

LESSON SUMMARY: ${params.lessonSummary}
`;

  if (params.contextDoc) {
    prompt += `\nCOURSE PEDAGOGICAL GUIDE:\n${params.contextDoc}\n`;
  }

  if (params.lessonContent) {
    prompt += `\nLESSON CONTENT SUMMARY:`;
    if (params.lessonContent.learningObjectives) {
      prompt += `\n- Learning Objectives: ${JSON.stringify(params.lessonContent.learningObjectives)}`;
    }
    if (params.lessonContent.keyTakeaways) {
      prompt += `\n- Key Takeaways: ${JSON.stringify(params.lessonContent.keyTakeaways)}`;
    }
    if (Array.isArray(params.lessonContent.sections)) {
      const sectionSummary = params.lessonContent.sections.map((s: Record<string, unknown>) => {
        if (s.type === "definition") return `Definition: ${s.term}`;
        if (s.type === "theorem") return `Theorem: ${s.name}`;
        if (s.type === "text") return "Text section";
        if (s.type === "math") return `Math: ${s.latex}`;
        if (s.type === "visualization") return `Visualization: ${s.caption}`;
        if (s.type === "code_block") return `Code (${s.language})`;
        return `${s.type}`;
      });
      prompt += `\n- Sections: ${sectionSummary.join(", ")}`;
    }
    prompt += "\n";
  }

  prompt += `
GUIDELINES:
1. Use LaTeX notation: $...$ for inline math, $$...$$ for display math.
2. Be encouraging and patient. Explain at the appropriate difficulty level.
3. When the student asks about a concept, reference the lesson content when relevant.
4. If asked about topics outside this lesson, briefly address it but guide back to the lesson material.
5. Keep responses concise unless the student asks for detailed explanations.
6. Use step-by-step reasoning for computational questions.${buildLanguageInstruction(params.language ?? "en")}`;

  return prompt;
}
