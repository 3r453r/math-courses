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
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { QuizResults } from "@/components/quiz/QuizResults";
import type { QuizQuestion, QuizAnswers, QuizResult } from "@/types/quiz";

interface DiagnosticData {
  id: string;
  questionsJson: string;
  status: string;
  attempts?: {
    id: string;
    score: number;
    answersJson: string;
    recommendation: string;
    weakAreas: string;
  }[];
}

interface Prerequisite {
  topic: string;
  importance: string;
  description: string;
}

interface DiagnosticQuestion {
  id: string;
  questionText: string;
  choices: { id: string; text: string; correct: boolean; explanation: string }[];
  prerequisiteTopic: string;
  difficulty: "easy" | "medium" | "hard";
}

export default function DiagnosticPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { t } = useTranslation(["diagnostic", "quiz", "common"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);
  const apiHeaders = useApiHeaders();

  const [courseTitle, setCourseTitle] = useState("");
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submittedAnswers, setSubmittedAnswers] = useState<QuizAnswers>({});
  const [addingPrereqs, setAddingPrereqs] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, courseId]);

  function mapDiagnosticQuestions(raw: DiagnosticQuestion[]): QuizQuestion[] {
    return raw.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      choices: q.choices,
      topic: q.prerequisiteTopic,
      difficulty: q.difficulty,
    }));
  }

  async function fetchData() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const course = await res.json();
      setCourseTitle(course.title);

      const diag: DiagnosticData | null = course.diagnosticQuiz;
      if (diag && diag.status === "ready") {
        setDiagnosticId(diag.id);
        const parsed = JSON.parse(diag.questionsJson) as {
          prerequisites: Prerequisite[];
          questions: DiagnosticQuestion[];
        };
        setPrerequisites(parsed.prerequisites);
        const mapped = mapDiagnosticQuestions(parsed.questions);
        setQuestions(mapped);

        // Load existing attempt
        if (diag.attempts?.[0]) {
          const attempt = diag.attempts[0];
          const savedAnswers: QuizAnswers = JSON.parse(attempt.answersJson);
          setSubmittedAnswers(savedAnswers);
          setResult({
            score: attempt.score,
            recommendation: attempt.recommendation as QuizResult["recommendation"],
            weakTopics: JSON.parse(attempt.weakAreas),
            topicScores: reconstructTopicScores(mapped, savedAnswers),
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(t("diagnostic:failedToLoadCourse"));
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
      const res = await fetch("/api/generate/diagnostic", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          courseId,
          model: generationModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate diagnostic");
      }
      const diag = await res.json();
      setDiagnosticId(diag.id);
      const parsed = JSON.parse(diag.questionsJson) as {
        prerequisites: Prerequisite[];
        questions: DiagnosticQuestion[];
      };
      setPrerequisites(parsed.prerequisites);
      setQuestions(mapDiagnosticQuestions(parsed.questions));
      toast.success(t("diagnostic:diagnosticGenerated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(answers: QuizAnswers) {
    if (!diagnosticId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/diagnostic-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosticQuizId: diagnosticId, answers }),
      });
      if (!res.ok) throw new Error("Failed to score diagnostic");
      const data = await res.json();
      setResult(data.result);
      setSubmittedAnswers(answers);
      if (data.prerequisites) setPrerequisites(data.prerequisites);
      toast.success(t("quiz:scoreResult", { score: Math.round(data.result.score * 100) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action: string, payload?: unknown) {
    if (action === "start") {
      router.push(`/courses/${courseId}`);
    } else if (action === "retake") {
      setResult(null);
      setSubmittedAnswers({});
    } else if (action === "add-prerequisites") {
      const data = payload as { topics: { title: string; summary: string }[] } | undefined;
      if (!data?.topics?.length) return;
      setAddingPrereqs(true);
      try {
        const res = await fetch(`/api/courses/${courseId}/add-prerequisites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: data.topics }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to add prerequisites");
        }
        const result = await res.json();
        toast.success(t("quiz:addedPrerequisites", { count: result.lessons.length }));
        router.push(`/courses/${courseId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add prerequisites");
      } finally {
        setAddingPrereqs(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("diagnostic:loadingDiagnostic")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}`)}
          >
            &larr; {t("diagnostic:backToCourse")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("diagnostic:prerequisiteAssessment")}</h1>
            <p className="text-sm text-muted-foreground">{courseTitle}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {questions.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle>{t("diagnostic:diagnosticQuiz")}</CardTitle>
              <CardDescription>
                {t("diagnostic:diagnosticDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Button onClick={handleGenerate} disabled={generating || !hasAnyApiKey}>
                {generating ? (
                  <>
                    <span className="animate-spin mr-2">&#9696;</span>
                    {t("diagnostic:generatingDiagnostic")}
                  </>
                ) : (
                  t("diagnostic:generateDiagnosticQuiz")
                )}
              </Button>
              {!hasAnyApiKey && (
                <p className="text-xs text-muted-foreground">
                  {t("common:apiKeyRequiredHint")}
                </p>
              )}
              <Button
                variant="ghost"
                onClick={() => router.push(`/courses/${courseId}`)}
              >
                {t("diagnostic:skipGoToCourse")}
              </Button>
            </CardContent>
          </Card>
        ) : result ? (
          <QuizResults
            questions={questions}
            answers={submittedAnswers}
            result={result}
            onAction={handleAction}
            variant="diagnostic"
            prerequisites={prerequisites}
            isAddingPrereqs={addingPrereqs}
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
