import { generateText } from "ai";
import { getApiKeysFromRequest, getModelInstance, hasAnyApiKey, MODELS } from "@/lib/ai/client";
import { buildVoiceInterpretationPrompt } from "@/lib/ai/prompts/voiceInterpretation";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error) return error;

  const apiKeys = getApiKeysFromRequest(request);
  if (!hasAnyApiKey(apiKeys)) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { transcript, context, model } = body;

  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

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
