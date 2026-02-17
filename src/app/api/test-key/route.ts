import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-utils";
import type { AIProvider } from "@/lib/ai/client";

export async function POST(request: Request) {
  const { error } = await getAuthUserFromRequest(request);
  if (error) return error;

  const body = await request.json();
  const { provider, apiKey } = body as { provider?: AIProvider; apiKey?: string };

  if (!apiKey) {
    return NextResponse.json({ error: "No API key provided" }, { status: 401 });
  }

  const resolvedProvider = provider || "anthropic";

  try {
    switch (resolvedProvider) {
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          }),
        });
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: data.error?.message || "Invalid API key" },
          { status: 401 }
        );
      }

      case "openai": {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          }),
        });
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: data.error?.message || "Invalid API key" },
          { status: 401 }
        );
      }

      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Hi" }] }],
            }),
          }
        );
        if (res.ok) return NextResponse.json({ valid: true });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: data.error?.message || "Invalid API key" },
          { status: 401 }
        );
      }

      default:
        return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to verify API key" },
      { status: 500 }
    );
  }
}
