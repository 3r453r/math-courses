import { describe, it, expect } from "vitest";
import { scoreQuiz } from "./scoring";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";

function makeQuestion(
  id: string,
  topic: string,
  correctIds: string[] = ["a"],
  allChoiceIds: string[] = ["a", "b", "c", "d"]
): QuizQuestion {
  return {
    id,
    questionText: `Question ${id}`,
    choices: allChoiceIds.map((cid) => ({
      id: cid,
      text: `Choice ${cid}`,
      correct: correctIds.includes(cid),
      explanation: `Explanation for ${cid}`,
    })),
    topic,
    difficulty: "medium",
  };
}

describe("scoreQuiz", () => {
  describe("basic scoring", () => {
    it("returns score 1.0 when all answers are correct", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
        makeQuestion("q3", "Algebra"),
      ];
      const answers: QuizAnswers = { q1: ["a"], q2: ["a"], q3: ["a"] };
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(1.0);
    });

    it("returns score 0.0 when all answers are wrong", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
      ];
      const answers: QuizAnswers = { q1: ["b"], q2: ["c"] };
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.0);
    });

    it("returns score 0.5 when half are correct", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
        makeQuestion("q3", "Algebra"),
        makeQuestion("q4", "Algebra"),
      ];
      const answers: QuizAnswers = {
        q1: ["a"],
        q2: ["a"],
        q3: ["b"],
        q4: ["b"],
      };
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.5);
    });

    it("returns score 0 for empty questions array", () => {
      const result = scoreQuiz([], {});
      expect(result.score).toBe(0);
    });

    it("treats missing answers as wrong", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
      ];
      const answers: QuizAnswers = { q1: ["a"] }; // q2 missing
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.5);
    });
  });

  describe("multi-correct logic", () => {
    it("rejects partial selection (subset of correct)", () => {
      const questions = [
        makeQuestion("q1", "Algebra", ["a", "b"]),
      ];
      const answers: QuizAnswers = { q1: ["a"] }; // missing "b"
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0);
    });

    it("rejects superset selection (extra choices)", () => {
      const questions = [
        makeQuestion("q1", "Algebra", ["a"]),
      ];
      const answers: QuizAnswers = { q1: ["a", "b"] }; // extra "b"
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0);
    });

    it("accepts exact multi-correct selection", () => {
      const questions = [
        makeQuestion("q1", "Algebra", ["a", "c"]),
      ];
      const answers: QuizAnswers = { q1: ["a", "c"] };
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(1.0);
    });
  });

  describe("recommendation thresholds", () => {
    function makeQuestions(count: number): QuizQuestion[] {
      return Array.from({ length: count }, (_, i) =>
        makeQuestion(`q${i}`, "Algebra")
      );
    }

    it('returns "advance" at exactly 80% (score = 0.8)', () => {
      const questions = makeQuestions(10);
      const answers: QuizAnswers = {};
      // 8 correct, 2 wrong
      for (let i = 0; i < 10; i++) {
        answers[`q${i}`] = i < 8 ? ["a"] : ["b"];
      }
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.8);
      expect(result.recommendation).toBe("advance");
    });

    it('returns "supplement" just under 80% (score ≈ 0.7)', () => {
      const questions = makeQuestions(10);
      const answers: QuizAnswers = {};
      for (let i = 0; i < 10; i++) {
        answers[`q${i}`] = i < 7 ? ["a"] : ["b"];
      }
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.7);
      expect(result.recommendation).toBe("supplement");
    });

    it('returns "supplement" at exactly 50% (score = 0.5)', () => {
      const questions = makeQuestions(10);
      const answers: QuizAnswers = {};
      for (let i = 0; i < 10; i++) {
        answers[`q${i}`] = i < 5 ? ["a"] : ["b"];
      }
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.5);
      expect(result.recommendation).toBe("supplement");
    });

    it('returns "regenerate" just under 50% (score ≈ 0.4)', () => {
      const questions = makeQuestions(10);
      const answers: QuizAnswers = {};
      for (let i = 0; i < 10; i++) {
        answers[`q${i}`] = i < 4 ? ["a"] : ["b"];
      }
      const result = scoreQuiz(questions, answers);
      expect(result.score).toBe(0.4);
      expect(result.recommendation).toBe("regenerate");
    });
  });

  describe("topic scoring", () => {
    it("calculates per-topic scores correctly", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
        makeQuestion("q3", "Calculus"),
        makeQuestion("q4", "Calculus"),
      ];
      const answers: QuizAnswers = {
        q1: ["a"], // correct
        q2: ["b"], // wrong
        q3: ["a"], // correct
        q4: ["a"], // correct
      };
      const result = scoreQuiz(questions, answers);
      expect(result.topicScores["Algebra"]).toBe(0.5);
      expect(result.topicScores["Calculus"]).toBe(1.0);
    });

    it("identifies weak topics (score < 0.6)", () => {
      const questions = [
        makeQuestion("q1", "Algebra"),
        makeQuestion("q2", "Algebra"),
        makeQuestion("q3", "Algebra"),
        makeQuestion("q4", "Calculus"),
        makeQuestion("q5", "Calculus"),
      ];
      // Algebra: 1/3 correct (0.33), Calculus: 2/2 (1.0)
      const answers: QuizAnswers = {
        q1: ["a"],
        q2: ["b"],
        q3: ["b"],
        q4: ["a"],
        q5: ["a"],
      };
      const result = scoreQuiz(questions, answers);
      expect(result.weakTopics).toContain("Algebra");
      expect(result.weakTopics).not.toContain("Calculus");
    });

    it("handles single-topic quiz", () => {
      const questions = [makeQuestion("q1", "Topology")];
      const answers: QuizAnswers = { q1: ["a"] };
      const result = scoreQuiz(questions, answers);
      expect(result.topicScores["Topology"]).toBe(1.0);
      expect(result.weakTopics).toHaveLength(0);
    });

    it("all topics weak when all wrong", () => {
      const questions = [
        makeQuestion("q1", "A"),
        makeQuestion("q2", "B"),
      ];
      const answers: QuizAnswers = { q1: ["b"], q2: ["b"] };
      const result = scoreQuiz(questions, answers);
      expect(result.weakTopics).toContain("A");
      expect(result.weakTopics).toContain("B");
    });
  });
});
