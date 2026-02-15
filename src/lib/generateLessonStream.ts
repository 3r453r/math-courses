/**
 * Generates lesson content and quiz in two separate API calls.
 * Each call runs in its own Vercel function with its own 300s timeout.
 */
export async function generateLessonWithQuiz(
  headers: Record<string, string>,
  body: {
    lessonId: string;
    courseId: string;
    model: string;
    weakTopics?: string[];
  },
  onStatus?: (status: "generating_lesson" | "generating_quiz") => void
): Promise<void> {
  // Step 1: Generate lesson content
  onStatus?.("generating_lesson");
  const lessonRes = await fetch("/api/generate/lesson", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!lessonRes.ok) {
    const data = await lessonRes.json();
    throw new Error(data.error || "Failed to generate lesson");
  }

  // Step 2: Generate quiz (separate function invocation, separate 300s budget)
  onStatus?.("generating_quiz");
  const quizRes = await fetch("/api/generate/quiz", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!quizRes.ok) {
    const data = await quizRes.json();
    throw new Error(data.error || "Failed to generate quiz");
  }
}
