"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/appStore";
import { useHydrated } from "@/stores/useHydrated";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { QuizResults } from "@/components/quiz/QuizResults";
import type { QuizQuestion, QuizAnswers, QuizResult } from "@/types/quiz";

interface QuizData {
  id: string;
  questionsJson: string;
  status: string;
  attempts: { id: string; score: number; answersJson: string; recommendation: string; weakTopics: string }[];
}

interface LessonData {
  id: string;
  title: string;
  summary: string;
  quizzes: QuizData[];
}

export default function LessonQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const { apiKey, generationModel } = useAppStore();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<QuizAnswers>({});

  useEffect(() => {
    if (!hydrated) return;
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchData();
  }, [hydrated, apiKey, lessonId, router]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const course = await res.json();
      const found = course.lessons.find((l: LessonData) => l.id === lessonId);
      if (!found) throw new Error("Lesson not found");
      setLesson(found);

      // Load existing quiz if available
      const quiz = found.quizzes?.[0];
      if (quiz && quiz.status === "ready") {
        const parsed: QuizQuestion[] = JSON.parse(quiz.questionsJson);
        setQuestions(parsed);
        setQuizId(quiz.id);

        // If there's an existing attempt, show results
        if (quiz.attempts?.[0]) {
          const attempt = quiz.attempts[0];
          const savedAnswers: QuizAnswers = JSON.parse(attempt.answersJson);
          setSubmittedAnswers(savedAnswers);
          setResult({
            score: attempt.score,
            recommendation: attempt.recommendation as QuizResult["recommendation"],
            weakTopics: JSON.parse(attempt.weakTopics),
            topicScores: reconstructTopicScores(parsed, savedAnswers),
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lesson");
    } finally {
      setLoading(false);
    }
  }

  function reconstructTopicScores(qs: QuizQuestion[], ans: QuizAnswers) {
    const topicCorrect: Record<string, number> = {};
    const topicTotal: Record<string, number> = {};
    for (const q of qs) {
      topicTotal[q.topic] = (topicTotal[q.topic] ?? 0) + 1;
      const correctIds = q.choices.filter((c) => c.correct).map((c) => c.id);
      const userIds = ans[q.id] ?? [];
      const isCorrect =
        correctIds.length === userIds.length &&
        correctIds.every((id) => userIds.includes(id));
      if (isCorrect) topicCorrect[q.topic] = (topicCorrect[q.topic] ?? 0) + 1;
    }
    const scores: Record<string, number> = {};
    for (const topic of Object.keys(topicTotal)) {
      scores[topic] = (topicCorrect[topic] ?? 0) / topicTotal[topic];
    }
    return scores;
  }

  async function handleGenerate() {
    if (!apiKey) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          lessonId,
          courseId,
          model: generationModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate quiz");
      }
      const quiz = await res.json();
      const parsed: QuizQuestion[] = JSON.parse(quiz.questionsJson);
      setQuestions(parsed);
      setQuizId(quiz.id);
      toast.success("Quiz generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(answers: QuizAnswers) {
    if (!quizId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/quiz-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers }),
      });
      if (!res.ok) throw new Error("Failed to score quiz");
      const data = await res.json();
      setResult(data.result);
      setSubmittedAnswers(answers);
      toast.success(`Score: ${Math.round(data.result.score * 100)}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateLesson() {
    if (!apiKey || !result) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate/lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          lessonId,
          courseId,
          model: generationModel,
          weakTopics: result.weakTopics,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to regenerate lesson");
      }
      toast.success("Lesson regenerated with focus on your weak areas!");
      router.push(`/courses/${courseId}/lessons/${lessonId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  function handleAction(action: string) {
    if (action === "advance") {
      router.push(`/courses/${courseId}`);
    } else if (action === "retake") {
      setResult(null);
      setSubmittedAnswers({});
    } else if (action === "regenerate") {
      handleRegenerateLesson();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}/lessons/${lessonId}`)}
          >
            &larr; Back to Lesson
          </Button>
          <div>
            <h1 className="text-xl font-bold">Lesson Quiz</h1>
            <p className="text-sm text-muted-foreground">{lesson?.title}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {questions.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Quiz Not Generated</CardTitle>
              <CardDescription>
                Generate a quiz to test your understanding of this lesson.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <span className="animate-spin mr-2">&#9696;</span>
                    Generating Quiz...
                  </>
                ) : (
                  "Generate Quiz"
                )}
              </Button>
            </CardContent>
          </Card>
        ) : result ? (
          <QuizResults
            questions={questions}
            answers={submittedAnswers}
            result={result}
            onAction={handleAction}
            variant="lesson"
            isRegenerating={regenerating}
          />
        ) : (
          <QuizRunner
            questions={questions}
            onSubmit={handleSubmit}
            isSubmitting={submitting}
          />
        )}
      </main>
    </div>
  );
}
