import type { QuizQuestion, QuizResult, QuizAnswers } from "@/types/quiz";

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: QuizAnswers
): QuizResult {
  let correct = 0;
  const topicCorrect: Record<string, number> = {};
  const topicTotal: Record<string, number> = {};

  for (const q of questions) {
    const correctChoiceIds = q.choices.filter((c) => c.correct).map((c) => c.id);
    const userChoiceIds = answers[q.id] ?? [];

    // Exact match: user selected ALL correct and NO incorrect
    const isCorrect =
      correctChoiceIds.length === userChoiceIds.length &&
      correctChoiceIds.every((id) => userChoiceIds.includes(id));

    if (isCorrect) correct++;

    topicTotal[q.topic] = (topicTotal[q.topic] ?? 0) + 1;
    if (isCorrect) topicCorrect[q.topic] = (topicCorrect[q.topic] ?? 0) + 1;
  }

  const score = questions.length > 0 ? correct / questions.length : 0;
  const topicScores: Record<string, number> = {};
  const weakTopics: string[] = [];

  for (const topic of Object.keys(topicTotal)) {
    const ts = (topicCorrect[topic] ?? 0) / topicTotal[topic];
    topicScores[topic] = ts;
    if (ts < 0.6) weakTopics.push(topic);
  }

  let recommendation: "advance" | "supplement" | "regenerate";
  if (score >= 0.8) {
    recommendation = "advance";
  } else if (score >= 0.5) {
    recommendation = "supplement";
  } else {
    recommendation = "regenerate";
  }

  return { score, recommendation, weakTopics, topicScores };
}
