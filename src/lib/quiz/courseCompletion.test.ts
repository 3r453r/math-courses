import { describe, it, expect } from "vitest";
import {
  evaluateCourseCompletion,
  DEFAULT_THRESHOLDS,
  type LessonScore,
  type CourseThresholds,
} from "./courseCompletion";

describe("evaluateCourseCompletion", () => {
  describe("weighted score calculation", () => {
    it("returns 0 for empty lesson list", () => {
      const result = evaluateCourseCompletion([], DEFAULT_THRESHOLDS);
      expect(result.weightedScore).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.failedLessons).toEqual([]);
      expect(result.blockedByFailedLesson).toBe(false);
    });

    it("computes correct weighted average with equal weights", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.9, weight: 1.0 },
        { lessonId: "b", bestScore: 0.7, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.weightedScore).toBe(0.8);
    });

    it("computes correct weighted average with unequal weights", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 1.0, weight: 3.0 },
        { lessonId: "b", bestScore: 0.5, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      // (1.0*3 + 0.5*1) / (3+1) = 3.5/4 = 0.875
      expect(result.weightedScore).toBe(0.875);
    });

    it("normalizes weights (weights do not need to sum to 1)", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.8, weight: 2.0 },
        { lessonId: "b", bestScore: 0.6, weight: 2.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      // (0.8*2 + 0.6*2) / (2+2) = 2.8/4 = 0.7
      expect(result.weightedScore).toBe(0.7);
    });

    it("handles a lesson with minimum weight 0.1", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 1.0, weight: 1.0 },
        { lessonId: "b", bestScore: 0.0, weight: 0.1 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      // (1.0*1 + 0.0*0.1) / (1+0.1) = 1.0/1.1 ≈ 0.909
      expect(result.weightedScore).toBeCloseTo(0.909, 2);
    });
  });

  describe("pass threshold", () => {
    it("passes when weighted score exactly equals threshold", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.8, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.passed).toBe(true);
    });

    it("fails when weighted score is just below threshold", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.79, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.passed).toBe(false);
    });

    it("passes with custom threshold (e.g., 0.6)", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.65, weight: 1.0 },
      ];
      const thresholds: CourseThresholds = {
        passThreshold: 0.6,
        noLessonCanFail: false,
        lessonFailureThreshold: 0.5,
      };
      const result = evaluateCourseCompletion(lessons, thresholds);
      expect(result.passed).toBe(true);
    });
  });

  describe("no lesson can fail", () => {
    it("blocks passing when any lesson is below failure threshold", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.95, weight: 1.0 },
        { lessonId: "b", bestScore: 0.4, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.passed).toBe(false);
      expect(result.failedLessons).toEqual(["b"]);
    });

    it("sets blockedByFailedLesson when score passes but lesson fails", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.95, weight: 3.0 },
        { lessonId: "b", bestScore: 0.4, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      // weighted = (0.95*3 + 0.4*1) / 4 = 3.25/4 = 0.8125 >= 0.8
      expect(result.weightedScore).toBeCloseTo(0.8125, 4);
      expect(result.passed).toBe(false);
      expect(result.blockedByFailedLesson).toBe(true);
      expect(result.failedLessons).toEqual(["b"]);
    });

    it("identifies all failed lesson IDs", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.3, weight: 1.0 },
        { lessonId: "b", bestScore: 0.9, weight: 1.0 },
        { lessonId: "c", bestScore: 0.4, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.failedLessons).toEqual(["a", "c"]);
    });

    it("ignores lesson failures when noLessonCanFail is false", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.95, weight: 3.0 },
        { lessonId: "b", bestScore: 0.3, weight: 1.0 },
      ];
      const thresholds: CourseThresholds = {
        passThreshold: 0.8,
        noLessonCanFail: false,
        lessonFailureThreshold: 0.5,
      };
      const result = evaluateCourseCompletion(lessons, thresholds);
      expect(result.failedLessons).toEqual([]);
      expect(result.blockedByFailedLesson).toBe(false);
      // weighted = (0.95*3 + 0.3*1) / 4 = 3.15/4 = 0.7875
      expect(result.passed).toBe(false); // below 0.8
    });
  });

  describe("lesson failure threshold", () => {
    it("uses default 0.5 threshold", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.49, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.failedLessons).toEqual(["a"]);
    });

    it("respects custom failure threshold", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.55, weight: 1.0 },
      ];
      const thresholds: CourseThresholds = {
        passThreshold: 0.5,
        noLessonCanFail: true,
        lessonFailureThreshold: 0.6,
      };
      const result = evaluateCourseCompletion(lessons, thresholds);
      expect(result.failedLessons).toEqual(["a"]);
    });

    it("lesson at exactly the failure threshold is NOT failed", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.5, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.failedLessons).toEqual([]);
    });
  });

  describe("backward compatibility", () => {
    it("equal weights (all 1.0) produces simple average", () => {
      const lessons: LessonScore[] = [
        { lessonId: "a", bestScore: 0.8, weight: 1.0 },
        { lessonId: "b", bestScore: 0.6, weight: 1.0 },
        { lessonId: "c", bestScore: 1.0, weight: 1.0 },
      ];
      const result = evaluateCourseCompletion(lessons, DEFAULT_THRESHOLDS);
      expect(result.weightedScore).toBeCloseTo(0.8, 10);
    });

    it("default thresholds match expected values", () => {
      expect(DEFAULT_THRESHOLDS.passThreshold).toBe(0.8);
      expect(DEFAULT_THRESHOLDS.noLessonCanFail).toBe(true);
      expect(DEFAULT_THRESHOLDS.lessonFailureThreshold).toBe(0.5);
    });
  });
});
