import { buildLanguageInstruction } from "./languageInstruction";

interface LessonPerformance {
  title: string;
  bestScore: number;
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
    language,
  } = params;

  return `You are a learning analytics specialist reviewing a student's performance in a completed course.

COURSE: ${courseTitle}
TOPIC: ${courseTopic}
DIFFICULTY: ${difficulty}
FOCUS AREAS: ${focusAreas.join(", ") || "General coverage"}

${contextDoc ? `COURSE CONTEXT DOCUMENT:\n${contextDoc}\n` : ""}
STUDENT PERFORMANCE DATA:
- Lessons completed: ${summaryData.lessonsCompleted}/${summaryData.totalLessons}
- Overall average quiz score: ${Math.round(summaryData.overallAverageScore * 100)}%

PER-LESSON BREAKDOWN:
${summaryData.perLesson
  .map(
    (l) =>
      `- "${l.title}": best score ${Math.round(l.bestScore * 100)}%, ` +
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
