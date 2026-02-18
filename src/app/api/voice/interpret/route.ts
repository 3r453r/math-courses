export const maxDuration = 60;

import { generateText } from "ai";
import { getApiKeysFromRequest, getModelInstance, hasAnyApiKey, MODELS } from "@/lib/ai/client";
import { buildVoiceInterpretationPrompt } from "@/lib/ai/prompts/voiceInterpretation";
import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import { z } from "zod";
import { parseBody } from "@/lib/api-validation";

const voiceInterpretSchema = z.object({
  transcript: z.string().min(1, "transcript required").max(5000),
  context: z.object({
    inMathMode: z.boolean().optional(),
    surroundingText: z.string().max(2000).optional(),
    language: z.string().max(10).optional(),
  }).optional(),
  model: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  const { error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { data: body, error: parseError } = await parseBody(request, voiceInterpretSchema);
  if (parseError) return parseError;

  const { transcript, context, model } = body;

  const interpreterContext = {
    inMathMode: context?.inMathMode ?? false,
    surroundingText: context?.surroundingText ?? "",
    language: context?.language ?? "en",
  };

  const systemPrompt = buildVoiceInterpretationPrompt(interpreterContext);
  const voiceModelId = model || MODELS.chat;
  const modelInstance = getModelInstance(voiceModelId, apiKeys);

  const { text } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: transcript,
  });

  return NextResponse.json({ result: text.trim() });
}
