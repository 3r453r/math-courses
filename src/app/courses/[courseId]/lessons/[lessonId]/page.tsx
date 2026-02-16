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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LessonContentRenderer } from "@/components/lesson/LessonContentRenderer";
import { ScratchpadPanel } from "@/components/scratchpad";
import { ChatPanel } from "@/components/chat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { GeneratingSpinner, TriviaSlideshow } from "@/components/generation";
import { generateLessonContent, generateQuiz } from "@/lib/generateLessonStream";
import {
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";
import type { LessonContent } from "@/types/lesson";

interface QuizInfo {
  id: string;
  status: string;
  attempts: { id: string; score: number; recommendation: string }[];
}

interface LessonDetail {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  contentJson: string | null;
  isSupplementary: boolean;
  courseId: string;
  quizzes?: QuizInfo[];
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const { t } = useTranslation(["lesson", "common"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);
  const scratchpadOpen = useAppStore((s) => s.scratchpadOpen);
  const setScratchpadOpen = useAppStore((s) => s.setScratchpadOpen);
  const chatSidebarOpen = useAppStore((s) => s.chatSidebarOpen);
  const setChatSidebarOpen = useAppStore((s) => s.setChatSidebarOpen);
  const apiHeaders = useApiHeaders();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, lessonId]);

  async function fetchLesson() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const course = await res.json();
      const found = course.lessons.find((l: LessonDetail) => l.id === lessonId);
      if (!found) throw new Error("Lesson not found");
      setLesson(found);
    } catch (err) {
      console.error(err);
      toast.error(t("lesson:failedToLoadLesson"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!hasAnyApiKey || !lesson) return;
    setGenerating(true);
    requestNotificationPermission();
    const lessonTitle = lesson.title;
    const lessonUrl = `/courses/${courseId}/lessons/${lessonId}`;
    const genBody = {
      lessonId: lesson.id,
      courseId,
      model: generationModel,
    };

    try {
      // Step 1: Generate lesson content (blocking)
      const warnings = await generateLessonContent(apiHeaders, genBody);
      toast.success(t("lesson:lessonContentGenerated"));
      if (warnings.length > 0) {
        toast.warning(t("lesson:vizMalformedWarning"), { duration: 10000 });
      }
      sendNotification(
        t("generation:lessonReady"),
        t("generation:lessonReadyBody", { title: lessonTitle }),
        lessonUrl
      );
      setGenerating(false);
      await fetchLesson();

      // Step 2: Generate quiz in background
      setGeneratingQuiz(true);
      try {
        await generateQuiz(apiHeaders, genBody);
        toast.success(t("lesson:quizGenerated"));
        await fetchLesson();
      } catch (quizErr) {
        toast.error(
          quizErr instanceof Error
            ? quizErr.message
            : t("lesson:quizGenerationFailed")
        );
      } finally {
        setGeneratingQuiz(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
      sendNotification(
        t("generation:generationFailed"),
        t("generation:generationFailedBody", { title: lessonTitle })
      );
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("lesson:loadingLesson")}</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>{t("lesson:lessonNotFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/courses/${courseId}`)}>
              {t("lesson:backToCourse")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasContent = !!lesson.contentJson;

  return (
    <div className="fixed inset-0 bg-background flex flex-col" data-testid="lesson-page-wrapper">
      <header className="border-b shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}`)}
          >
            &larr; {t("lesson:courseOverview")}
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {t("lesson:lessonIndex", { index: lesson.orderIndex })}
              </span>
              <Badge
                variant={lesson.status === "ready" ? "default" : "outline"}
              >
                {lesson.status}
              </Badge>
              {lesson.isSupplementary && (
                <Badge variant="secondary" className="hidden sm:inline-flex">{t("common:supplementary")}</Badge>
              )}
            </div>
            <h1 className="text-xl font-bold truncate">{lesson.title}</h1>
          </div>
          <ThemeToggle />
          <UserMenu />
          {hasContent && (
            <>
              <Button
                variant={chatSidebarOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  if (!chatSidebarOpen) setScratchpadOpen(false);
                  setChatSidebarOpen(!chatSidebarOpen);
                }}
                title={t("lesson:toggleChat")}
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
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                <span className="hidden md:inline">{t("lesson:chat")}</span>
              </Button>
              <Button
                variant={scratchpadOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  if (!scratchpadOpen) setChatSidebarOpen(false);
                  setScratchpadOpen(!scratchpadOpen);
                }}
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
            </>
          )}
        </div>
      </header>

      <div
        className={`flex-1 min-h-0 ${(scratchpadOpen || chatSidebarOpen) && hasContent ? "flex" : "overflow-y-auto"}`}
        data-testid="lesson-scroll-container"
      >
          <main
            data-testid="lesson-main"
            className={
              (scratchpadOpen || chatSidebarOpen) && hasContent
                ? "hidden md:block md:w-3/5 lg:w-1/2 overflow-y-auto px-6 pt-8 pb-4"
                : "flex-1 container mx-auto px-4 py-8 max-w-4xl"
            }
          >
            {!hasContent ? (
              <Card className="max-w-lg mx-auto">
                <CardHeader className="text-center">
                  <CardTitle>{t("lesson:lessonNotGenerated")}</CardTitle>
                  <CardDescription>
                    {lesson.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  {generating ? (
                    <>
                      <GeneratingSpinner />
                      <p className="text-sm text-muted-foreground text-center">
                        {t("generation:browseAwayMessage")}
                      </p>
                      <TriviaSlideshow courseId={courseId} lessonId={lessonId} />
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground text-center">
                        {t("lesson:generateDescription")}
                      </p>
                      <Button onClick={handleGenerate} disabled={!hasAnyApiKey}>
                        {t("lesson:generateLessonContent")}
                      </Button>
                      {!hasAnyApiKey && (
                        <p className="text-xs text-muted-foreground">
                          {t("common:apiKeyRequiredHint")}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{lesson.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lesson.summary}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating || generatingQuiz || !hasAnyApiKey}
                  >
                    {generating ? <GeneratingSpinner /> : t("lesson:regenerate")}
                  </Button>
                </div>
                <LessonContentRenderer
                  content={JSON.parse(lesson.contentJson!) as LessonContent}
                />

                {/* Quiz section */}
                <Card className="mt-8">
                  <CardContent className="pt-6">
                    {generatingQuiz ? (
                      <div className="flex items-center gap-3">
                        <svg className="size-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <div>
                          <p className="font-medium text-sm">{t("lesson:generatingQuiz")}</p>
                          <p className="text-xs text-muted-foreground">{t("lesson:quizGeneratingHint")}</p>
                        </div>
                      </div>
                    ) : lesson.quizzes?.[0]?.attempts?.[0] ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-sm">{t("lesson:lessonQuiz")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("lesson:score", { score: Math.round(lesson.quizzes[0].attempts[0].score * 100) })}
                            </p>
                          </div>
                          <Badge
                            variant={
                              lesson.quizzes[0].attempts[0].score >= 0.8
                                ? "default"
                                : lesson.quizzes[0].attempts[0].score >= 0.5
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {lesson.quizzes[0].attempts[0].recommendation}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/courses/${courseId}/lessons/${lessonId}/quiz`
                            )
                          }
                        >
                          {t("lesson:reviewRetake")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t("lesson:readyToTest")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("lesson:quizPrompt")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/courses/${courseId}/lessons/${lessonId}/quiz`
                            )
                          }
                        >
                          {t("lesson:takeQuiz")}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </main>

          {(scratchpadOpen || chatSidebarOpen) && hasContent && (
            <aside
              className="w-full md:w-2/5 lg:w-1/2 shrink-0 h-full"
              data-testid={scratchpadOpen ? "scratchpad-aside" : "chat-aside"}
            >
              {scratchpadOpen ? (
                <ScratchpadPanel
                  lessonId={lessonId}
                  onClose={() => setScratchpadOpen(false)}
                />
              ) : (
                <ChatPanel
                  lessonId={lessonId}
                  courseId={courseId}
                  onClose={() => setChatSidebarOpen(false)}
                />
              )}
            </aside>
          )}
      </div>
    </div>
  );
}
