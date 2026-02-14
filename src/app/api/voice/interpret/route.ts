import { generateText } from "ai";
import { getAnthropicClient, getApiKeyFromRequest, MODELS } from "@/lib/ai/client";
import { buildVoiceInterpretationPrompt } from "@/lib/ai/prompts/voiceInterpretation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
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
  const anthropic = getAnthropicClient(apiKey);

  const { text } = await generateText({
    model: anthropic(model || MODELS.chat),
    system: systemPrompt,
    prompt: transcript,
  });

  return NextResponse.json({ result: text.trim() });
}
