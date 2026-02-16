"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useHydrated } from "@/stores/useHydrated";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { ScoreBar } from "@/components/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

interface LessonPerformance {
  title: string;
  bestScore: number;
  weight: number;
  quizGenerations: number;
  weakTopicsAcrossAttempts: string[];
}

interface Recommendation {
  type: string;
  suggestedTopic: string;
  suggestedDescription: string;
  suggestedDifficulty: string;
  suggestedFocusAreas: string[];
  rationale: string;
}

interface CompletionData {
  summaryData: {
    totalLessons: number;
    lessonsCompleted: number;
    overallAverageScore: number;
    perLesson: LessonPerformance[];
    aggregateWeakTopics: Array<{ topic: string; frequency: number; latestScore: number }>;
  };
  narrative: string | null;
  recommendation: Recommendation | null;
  completedAt: string;
}

export default function CompletionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation(["completion", "common"]);

  useEffect(() => {
    if (!hydrated) return;
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, courseId]);

  async function fetchSummary() {
    try {
      const res = await fetch(`/api/courses/${courseId}/completion-summary`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch completion summary:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleStartRecommendedCourse() {
    if (!data?.recommendation) return;
    const { suggestedTopic, suggestedDescription, suggestedDifficulty, suggestedFocusAreas } =
      data.recommendation;
    const params = new URLSearchParams({
      topic: suggestedTopic,
      description: suggestedDescription,
      difficulty: suggestedDifficulty,
      focusAreas: JSON.stringify(suggestedFocusAreas),
    });
    router.push(`/courses/new?${params.toString()}`);
  }

  if (!hydrated) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("completion:loading")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("completion:noSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/courses/${courseId}`)}>
              {t("completion:backToCourse")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summaryData, narrative, recommendation } = data;
  const avgPct = Math.round(summaryData.overallAverageScore * 100);
  const completedDate = new Date(data.completedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/courses/${courseId}`)}>
            &larr; {t("completion:backToCourse")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("completion:title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("completion:completedOn", { date: completedDate })}
            </p>
          </div>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {/* Score badge */}
        <Card>
          <CardContent className="flex items-center gap-6 pt-6">
            <div
              className={`text-5xl font-bold tabular-nums ${
                avgPct >= 80
                  ? "text-emerald-600"
                  : avgPct >= 50
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {avgPct}%
            </div>
            <div>
              <p className="font-medium">{t("completion:weightedScore")}</p>
              <p className="text-sm text-muted-foreground">
                {t("completion:lessonsCompletedOf", {
                  completed: summaryData.lessonsCompleted,
                  total: summaryData.totalLessons,
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Narrative Summary */}
        {narrative && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("completion:learningSummary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MathMarkdown content={narrative} className="text-sm" />
            </CardContent>
          </Card>
        )}

        {/* Per-Lesson Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("completion:lessonPerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summaryData.perLesson.map((lesson) => (
                <div
                  key={lesson.title}
                  className="flex items-center gap-3 rounded-md px-2 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      {lesson.weight != null && lesson.weight !== 1.0 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {t("completion:lessonWeight")}: {lesson.weight}x
                        </Badge>
                      )}
                    </div>
                    {lesson.quizGenerations > 1 && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("completion:regenerations", { count: lesson.quizGenerations - 1 })}
                      </p>
                    )}
                  </div>
                  <ScoreBar score={lesson.bestScore} showLabel className="w-28" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Recommendation */}
        {recommendation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("completion:recommendedCourse")}</CardTitle>
              <CardDescription>{recommendation.rationale}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("completion:topic")}:
                  </span>
                  <span className="text-sm font-medium">{recommendation.suggestedTopic}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {recommendation.suggestedDescription}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("completion:difficulty")}:
                  </span>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {recommendation.suggestedDifficulty}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs font-medium text-muted-foreground mr-1">
                    {t("completion:focusAreas")}:
                  </span>
                  {recommendation.suggestedFocusAreas.map((area) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="mt-4" onClick={handleStartRecommendedCourse}>
                {t("completion:startRecommendedCourse")}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
