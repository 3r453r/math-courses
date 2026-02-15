/**
 * Calls the lesson generation endpoint and reads the SSE stream.
 * Returns the final result or throws on error.
 */
export async function generateLessonStream(
  headers: Record<string, string>,
  body: {
    lessonId: string;
    courseId: string;
    model: string;
    weakTopics?: string[];
  }
): Promise<{ lesson: unknown; quiz: unknown }> {
  const res = await fetch("/api/generate/lesson", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Non-streaming error (auth, validation, etc.)
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      throw new Error(data.error || "Failed to generate lesson");
    }
    throw new Error(`Failed to generate lesson (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Mock model returns JSON directly
  if (contentType.includes("application/json")) {
    return res.json();
  }

  // SSE stream from real AI generation
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // Keep incomplete event in buffer

    for (const event of events) {
      const lines = event.split("\n");
      let eventType = "";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("data:")) data = line.slice(5).trim();
      }

      if (eventType === "error") {
        const parsed = JSON.parse(data);
        throw new Error(parsed.error || "Generation failed");
      }

      if (eventType === "result") {
        return JSON.parse(data);
      }
    }
  }

  throw new Error("Stream ended without result");
}
