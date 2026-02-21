import { generateObject } from "ai";
import {
  getApiKeysFromRequest,
  getModelInstance,
  getProviderOptions,
  hasAnyApiKey,
} from "@/lib/ai/client";
import { mockPracticeCheck } from "@/lib/ai/mockData";
import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCheapestModel } from "@/lib/ai/repairSchema";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const practiceCheckBodySchema = z.object({
  questionText: z.string().min(1).max(2000),
  studentAnswer: z.string().min(1).max(5000),
  solution: z.string().min(1).max(5000),
  keyPoints: z.array(z.string().max(200)).max(20).default([]),
  model: z.string().max(100).optional(),
});

const checkResultSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string(),
  keyPointsMet: z.array(z.string()),
});

const PRACTICE_CHECK_RATE_LIMIT = {
  namespace: "practice:check",
  windowMs: 60_000,
  maxRequests: 20,
} as const;

export async function POST(request: Request) {
  const { userId, error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const rateLimitResponse = enforceRateLimit({
    request,
    userId,
    route: "/api/practice/check",
    config: PRACTICE_CHECK_RATE_LIMIT,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { data: body, error: parseError } = await parseBody(
    request,
    practiceCheckBodySchema
  );
  if (parseError) return parseError;

  if (body.model === "mock") {
    return NextResponse.json(mockPracticeCheck(body.keyPoints));
  }

  const cheapModel = getCheapestModel(apiKeys);
  if (!cheapModel) {
    return NextResponse.json({ error: "No model available" }, { status: 400 });
  }

  const modelInstance = getModelInstance(cheapModel, apiKeys);

  const keyPointsSection =
    body.keyPoints.length > 0
      ? `\nKey points to evaluate:\n${body.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join("\n")}`
      : "";

  const prompt = `You are a helpful tutor evaluating a student's answer to a practice exercise.

Question: ${body.questionText}

Expected solution: ${body.solution}${keyPointsSection}

Student's answer: ${body.studentAnswer}

Evaluate the student's answer and return:
- score: a number from 0.0 (completely wrong) to 1.0 (fully correct)
- feedback: 1-2 sentences of constructive, encouraging feedback
- keyPointsMet: which of the provided key points (copy the exact text) the student's answer addressed${body.keyPoints.length === 0 ? "; return an empty array since no key points were provided" : ""}

Be honest but encouraging. Acknowledge partial understanding.`;

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: checkResultSchema,
      prompt,
      providerOptions: getProviderOptions(cheapModel),
    });

    return NextResponse.json(object);
  } catch (err) {
    console.error("Practice answer check failed:", err);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}
