"use client";

import { useEffect, useState, use } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  PreviewBanner,
  LockedDAGView,
  PreviewLessonView,
  PreviewQuizView,
} from "@/components/preview";
import { parseSubjects } from "@/lib/subjects";
import type { LessonContent } from "@/types/lesson";
import { parseLessonContent } from "@/lib/content/parseLessonContent";
import type { QuizQuestion } from "@/types/quiz";

interface PreviewLesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
}

interface PreviewEdge {
  id: string;
  fromLessonId: string;
  toLessonId: string;
  relationship: string;
}

interface PreviewData {
  shareToken: string;
  previewLessonId: string;
  course: {
    title: string;
    description: string;
    topic: string;
    subject: string;
    focusAreas: string;
    difficulty: string;
    language: string;
    status: string;
    authorName: string | null;
    lessons: PreviewLesson[];
    edges: PreviewEdge[];
  };
  previewContent: {
    contentJson: string | null;
    quiz: {
      id: string;
      questionsJson: string;
      questionCount: number;
    } | null;
  } | null;
}

type ViewState = "overview" | "lesson" | "quiz";

export default function PreviewPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);
  const { t } = useTranslation(["preview", "common"]);
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("overview");

  useEffect(() => {
    fetch(`/api/preview/${shareToken}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load preview");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("common:loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("common:error")}</CardTitle>
            <CardDescription>{error || "Preview not available"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const course = data.course;
  const focusAreas: string[] = (() => {
    try { return JSON.parse(course.focusAreas || "[]"); }
    catch { return []; }
  })();
  const subjects = parseSubjects(course.subject);

  let lessonContent: LessonContent | null = null;
  if (data.previewContent?.contentJson) {
    try { lessonContent = parseLessonContent(data.previewContent.contentJson); }
    catch { /* ignore */ }
  }

  let quizQuestions: QuizQuestion[] | null = null;
  if (data.previewContent?.quiz?.questionsJson) {
    try { quizQuestions = JSON.parse(data.previewContent.quiz.questionsJson); }
    catch { /* ignore */ }
  }

  const previewLesson = course.lessons.find((l) => l.id === data.previewLessonId);

  return (
    <div className="min-h-screen bg-background">
      <PreviewBanner />

      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{course.title}</h1>
              <Badge variant="outline" className="capitalize">{course.difficulty}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{course.description}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {view === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
              <Badge variant="secondary">{course.topic}</Badge>
              {focusAreas.map((a) => (
                <Badge key={a} variant="outline">{a}</Badge>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("preview:courseOverview")}</CardTitle>
                <CardDescription>
                  {t("preview:lessonCount", { count: course.lessons.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LockedDAGView
                  lessons={course.lessons}
                  edges={course.edges}
                  previewLessonId={data.previewLessonId}
                  onPreviewClick={() => setView("lesson")}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {view === "lesson" && lessonContent && previewLesson && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{previewLesson.title}</h2>
            <p className="text-muted-foreground">{previewLesson.summary}</p>
            <PreviewLessonView
              content={lessonContent}
              shareToken={shareToken}
              hasQuiz={!!quizQuestions && quizQuestions.length > 0}
              onTakeQuiz={() => setView("quiz")}
              onBack={() => setView("overview")}
            />
          </div>
        )}

        {view === "quiz" && quizQuestions && quizQuestions.length > 0 && (
          <PreviewQuizView
            questions={quizQuestions}
            shareToken={shareToken}
            onBack={() => setView("overview")}
          />
        )}
      </main>
    </div>
  );
}
