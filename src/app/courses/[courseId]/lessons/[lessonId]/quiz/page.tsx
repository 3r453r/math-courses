"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasAnyApiKey } from "@/stores/appStore";
import { useHydrated } from "@/stores/useHydrated";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { ScratchpadPanel } from "@/components/scratchpad";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { QuizResults } from "@/components/quiz/QuizResults";
import { generateLessonWithQuiz } from "@/lib/generateLessonStream";
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
  const { t } = useTranslation(["quiz", "common", "lesson"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);
  const apiHeaders = useApiHeaders();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<QuizAnswers>({});
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, lessonId]);

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
      toast.error(t("lesson:failedToLoadLesson"));
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
    if (!hasAnyApiKey) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/quiz", {
        method: "POST",
        headers: apiHeaders,
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
      toast.success(t("quiz:quizGenerated"));
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
      toast.success(t("quiz:scoreResult", { score: Math.round(data.result.score * 100) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateLesson() {
    if (!hasAnyApiKey || !result) return;
    setRegenerating(true);
    try {
      await generateLessonWithQuiz(apiHeaders, {
        lessonId,
        courseId,
        model: generationModel,
        weakTopics: result.weakTopics,
      });
      toast.success(t("quiz:lessonRegenerated"));
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
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("quiz:loadingQuiz")}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <header className="border-b shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}/lessons/${lessonId}`)}
          >
            &larr; {t("quiz:backToLesson")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("quiz:lessonQuiz")}</h1>
            <p className="text-sm text-muted-foreground">{lesson?.title}</p>
          </div>
          <ThemeToggle />
          <Button
            variant={scratchpadOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setScratchpadOpen(!scratchpadOpen)}
            title={t("lesson:toggleScratchpad")}
          >
            <svg
              className="size-4 md:mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
            <span className="hidden md:inline">{t("lesson:scratchpad")}</span>
          </Button>
          <UserMenu />
        </div>
      </header>

      <div className={`flex-1 min-h-0 ${scratchpadOpen ? "flex" : "overflow-y-auto"}`}>
        <main
          className={
            scratchpadOpen
              ? "hidden md:block md:w-3/5 lg:w-1/2 overflow-y-auto px-6 pt-8 pb-4"
              : "flex-1 container mx-auto px-4 py-8 max-w-3xl"
          }
        >
          {questions.length === 0 ? (
            <Card className="max-w-lg mx-auto">
              <CardHeader className="text-center">
                <CardTitle>{t("quiz:quizNotGenerated")}</CardTitle>
                <CardDescription>
                  {t("quiz:quizNotGeneratedDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <Button onClick={handleGenerate} disabled={generating || !hasAnyApiKey}>
                  {generating ? (
                    <>
                      <span className="animate-spin mr-2">&#9696;</span>
                      {t("quiz:generatingQuiz")}
                    </>
                  ) : (
                    t("quiz:generateQuiz")
                  )}
                </Button>
                {!hasAnyApiKey && (
                  <p className="text-xs text-muted-foreground">
                    {t("common:apiKeyRequiredHint")}
                  </p>
                )}
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

        {scratchpadOpen && (
          <aside className="w-full md:w-2/5 lg:w-1/2 shrink-0 h-full">
            <ScratchpadPanel
              lessonId={lessonId}
              onClose={() => setScratchpadOpen(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
