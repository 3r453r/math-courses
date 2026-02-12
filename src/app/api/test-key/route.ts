import { getApiKeyFromRequest } from "@/lib/ai/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No API key provided" }, { status: 401 });
  }

  try {
    // Make a minimal API call to verify the key works
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (res.ok) {
      return NextResponse.json({ valid: true });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.error?.message || "Invalid API key" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to verify API key" },
      { status: 500 }
    );
  }
}
