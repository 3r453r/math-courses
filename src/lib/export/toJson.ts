import type { FullCourseData } from "./courseData";

const EXPORT_VERSION = 1;

export interface CourseExportJson {
  version: number;
  exportedAt: string;
  course: {
    title: string;
    description: string;
    topic: string;
    subject?: string; // JSON array string or legacy single string
    focusAreas: string;
    targetLessonCount: number;
    difficulty: string;
    language: string;
    contextDoc: string | null;
    passThreshold: number;
    noLessonCanFail: boolean;
    lessonFailureThreshold: number;
    status: string;
  };
  lessons: Array<{
    orderIndex: number;
    title: string;
    summary: string;
    status: string;
    contentJson: string | null;
    rawMarkdown: string | null;
    isSupplementary: boolean;
    weight: number;
    completedAt: string | null;
    quizzes: Array<{
      questionsJson: string;
      questionCount: number;
      status: string;
      generation: number;
      isActive: boolean;
      attempts: Array<{
        answersJson: string;
        score: number;
        weakTopics: string;
        recommendation: string;
        createdAt: string;
      }>;
    }>;
    notes: Array<{
      title: string | null;
      content: string;
      isScratchpad: boolean;
      orderIndex: number;
    }>;
    chatMessages: Array<{
      role: string;
      content: string;
      createdAt: string;
    }>;
  }>;
  edges: Array<{
    fromLessonIndex: number;
    toLessonIndex: number;
    relationship: string;
  }>;
  courseNotes: Array<{
    title: string | null;
    content: string;
    isScratchpad: boolean;
    orderIndex: number;
  }>;
  diagnosticQuiz: {
    questionsJson: string;
    status: string;
    attempts: Array<{
      answersJson: string;
      score: number;
      weakAreas: string;
      recommendation: string;
      suggestedCourseTitle: string | null;
      createdAt: string;
    }>;
  } | null;
  completionSummary: {
    summaryJson: string;
    narrativeMarkdown: string | null;
    recommendationJson: string | null;
    completedAt: string;
  } | null;
}

/**
 * Convert full course data to a portable JSON export format.
 * Internal IDs are stripped and replaced with index-based references.
 */
export function toExportJson(data: FullCourseData): CourseExportJson {
  // Build a map from lesson ID to orderIndex for edge references
  const lessonIdToIndex = new Map<string, number>();
  for (const lesson of data.lessons) {
    lessonIdToIndex.set(lesson.id, lesson.orderIndex);
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    course: {
      title: data.title,
      description: data.description,
      topic: data.topic,
      subject: data.subject,
      focusAreas: data.focusAreas,
      targetLessonCount: data.targetLessonCount,
      difficulty: data.difficulty,
      language: data.language,
      contextDoc: data.contextDoc,
      passThreshold: data.passThreshold,
      noLessonCanFail: data.noLessonCanFail,
      lessonFailureThreshold: data.lessonFailureThreshold,
      status: data.status,
    },
    lessons: data.lessons.map((lesson) => ({
      orderIndex: lesson.orderIndex,
      title: lesson.title,
      summary: lesson.summary,
      status: lesson.status,
      contentJson: lesson.contentJson,
      rawMarkdown: lesson.rawMarkdown,
      isSupplementary: lesson.isSupplementary,
      weight: lesson.weight,
      completedAt: lesson.completedAt?.toISOString() ?? null,
      quizzes: lesson.quizzes.map((quiz) => ({
        questionsJson: quiz.questionsJson,
        questionCount: quiz.questionCount,
        status: quiz.status,
        generation: quiz.generation,
        isActive: quiz.isActive,
        attempts: quiz.attempts.map((attempt) => ({
          answersJson: attempt.answersJson,
          score: attempt.score,
          weakTopics: attempt.weakTopics,
          recommendation: attempt.recommendation,
          createdAt: attempt.createdAt.toISOString(),
        })),
      })),
      notes: lesson.notes.map((note) => ({
        title: note.title,
        content: note.content,
        isScratchpad: note.isScratchpad,
        orderIndex: note.orderIndex,
      })),
      chatMessages: lesson.chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
    })),
    edges: data.edges.map((edge) => ({
      fromLessonIndex: lessonIdToIndex.get(edge.fromLessonId) ?? -1,
      toLessonIndex: lessonIdToIndex.get(edge.toLessonId) ?? -1,
      relationship: edge.relationship,
    })),
    courseNotes: (data.notes ?? []).map((note) => ({
      title: note.title,
      content: note.content,
      isScratchpad: note.isScratchpad,
      orderIndex: note.orderIndex,
    })),
    diagnosticQuiz: data.diagnosticQuiz
      ? {
          questionsJson: data.diagnosticQuiz.questionsJson,
          status: data.diagnosticQuiz.status,
          attempts: data.diagnosticQuiz.attempts.map((attempt) => ({
            answersJson: attempt.answersJson,
            score: attempt.score,
            weakAreas: attempt.weakAreas,
            recommendation: attempt.recommendation,
            suggestedCourseTitle: attempt.suggestedCourseTitle,
            createdAt: attempt.createdAt.toISOString(),
          })),
        }
      : null,
    completionSummary: data.completionSummary
      ? {
          summaryJson: data.completionSummary.summaryJson,
          narrativeMarkdown: data.completionSummary.narrativeMarkdown,
          recommendationJson: data.completionSummary.recommendationJson,
          completedAt: data.completionSummary.completedAt.toISOString(),
        }
      : null,
  };
}
