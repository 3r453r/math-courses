import { buildLanguageInstruction } from "./languageInstruction";

interface LessonPerformance {
  title: string;
  bestScore: number;
  weight: number;
  quizGenerations: number;
  weakTopicsAcrossAttempts: string[];
}

interface AggregateWeakTopic {
  topic: string;
  frequency: number;
  latestScore: number;
}

interface CompletionSummaryParams {
  courseTitle: string;
  courseTopic: string;
  difficulty: string;
  contextDoc: string | null;
  focusAreas: string[];
  summaryData: {
    totalLessons: number;
    lessonsCompleted: number;
    overallAverageScore: number;
    perLesson: LessonPerformance[];
    aggregateWeakTopics: AggregateWeakTopic[];
  };
  passThreshold?: number;
  noLessonCanFail?: boolean;
  lessonFailureThreshold?: number;
  passed?: boolean;
  language?: string;
}

export function buildCompletionSummaryPrompt(params: CompletionSummaryParams): string {
  const {
    courseTitle,
    courseTopic,
    difficulty,
    contextDoc,
    focusAreas,
    summaryData,
    passThreshold,
    noLessonCanFail,
    lessonFailureThreshold,
    passed,
    language,
  } = params;

  return `You are a learning analytics specialist reviewing a student's performance in a completed course.

COURSE: ${courseTitle}
TOPIC: ${courseTopic}
DIFFICULTY: ${difficulty}
FOCUS AREAS: ${focusAreas.join(", ") || "General coverage"}

${contextDoc ? `COURSE CONTEXT DOCUMENT:\n${contextDoc}\n` : ""}
COURSE COMPLETION THRESHOLDS:
- Pass threshold: ${Math.round((passThreshold ?? 0.8) * 100)}% (weighted score)
- No lesson can be failed: ${(noLessonCanFail ?? true) ? "Yes" : "No"}${(noLessonCanFail ?? true) ? `\n- Lesson failure threshold: ${Math.round((lessonFailureThreshold ?? 0.5) * 100)}%` : ""}
- Course result: ${passed !== undefined ? (passed ? "PASSED" : "NOT YET PASSED") : "N/A"}

STUDENT PERFORMANCE DATA:
- Lessons completed: ${summaryData.lessonsCompleted}/${summaryData.totalLessons}
- Overall weighted score: ${Math.round(summaryData.overallAverageScore * 100)}%

PER-LESSON BREAKDOWN (with weights):
${summaryData.perLesson
  .map(
    (l) =>
      `- "${l.title}" [weight: ${l.weight ?? 1.0}]: best score ${Math.round(l.bestScore * 100)}%, ` +
      `${l.quizGenerations} quiz generation(s), ` +
      `weak areas: ${l.weakTopicsAcrossAttempts.length > 0 ? l.weakTopicsAcrossAttempts.join(", ") : "none"}`
  )
  .join("\n")}

PERSISTENT WEAK TOPICS (appeared across multiple lessons/attempts):
${
  summaryData.aggregateWeakTopics.length > 0
    ? summaryData.aggregateWeakTopics
        .map(
          (t) =>
            `- ${t.topic}: appeared ${t.frequency} time(s), latest score ${Math.round(t.latestScore * 100)}%`
        )
        .join("\n")
    : "None identified"
}

TASKS:
1. Write a narrative summary of the learning journey (200-400 words, Markdown).
   - Be encouraging and constructive
   - Reference specific lessons and topics
   - Note areas of strength and areas needing more work
   - Mention if the student needed regenerations for any lessons (this means they struggled and retried)

2. Recommend a follow-up course:
   - If strong performance (>85% average, few regenerations): suggest advancing to next difficulty or broader related topic
   - If moderate (70-85%): suggest same difficulty with focus on weak areas
   - If weak areas persist: suggest a weakness-focused course targeting those specific topics
   - Provide a specific topic, description, difficulty, and 3-5 focus areas${buildLanguageInstruction(language ?? "en")}`;
}
