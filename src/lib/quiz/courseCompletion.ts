export interface LessonScore {
  lessonId: string;
  bestScore: number;
  weight: number;
}

export interface CourseThresholds {
  passThreshold: number;
  noLessonCanFail: boolean;
  lessonFailureThreshold: number;
}

export interface CourseCompletionResult {
  weightedScore: number;
  passed: boolean;
  failedLessons: string[];
  blockedByFailedLesson: boolean;
}

export const DEFAULT_THRESHOLDS: CourseThresholds = {
  passThreshold: 0.8,
  noLessonCanFail: true,
  lessonFailureThreshold: 0.5,
};

export function evaluateCourseCompletion(
  lessonScores: LessonScore[],
  thresholds: CourseThresholds
): CourseCompletionResult {
  if (lessonScores.length === 0) {
    return {
      weightedScore: 0,
      passed: false,
      failedLessons: [],
      blockedByFailedLesson: false,
    };
  }

  const totalWeight = lessonScores.reduce((sum, ls) => sum + ls.weight, 0);

  const weightedScore =
    totalWeight > 0
      ? lessonScores.reduce((sum, ls) => sum + ls.bestScore * ls.weight, 0) /
        totalWeight
      : 0;

  const failedLessons = thresholds.noLessonCanFail
    ? lessonScores
        .filter((ls) => ls.bestScore < thresholds.lessonFailureThreshold)
        .map((ls) => ls.lessonId)
    : [];

  const meetsScoreThreshold = weightedScore >= thresholds.passThreshold;
  const meetsLessonRequirement = failedLessons.length === 0;

  return {
    weightedScore,
    passed: meetsScoreThreshold && meetsLessonRequirement,
    failedLessons,
    blockedByFailedLesson: meetsScoreThreshold && !meetsLessonRequirement,
  };
}
