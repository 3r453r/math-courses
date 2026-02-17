"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
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
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LessonContentRenderer } from "@/components/lesson/LessonContentRenderer";
import { LessonBreadcrumbs } from "@/components/lesson/LessonBreadcrumbs";
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
  createdAt: string;
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
  updatedAt: string;
  quizzes?: QuizInfo[];
}

interface CourseNav {
  title: string;
  lessons: {
    id: string;
    title: string;
    orderIndex: number;
    status: string;
    completedAt?: string | null;
    isSupplementary: boolean;
  }[];
  edges: { fromLessonId: string; toLessonId: string }[];
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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
  const [courseNav, setCourseNav] = useState<CourseNav | null>(null);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<"peek" | "half" | "full">("half");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  // Tracks whether generation was initiated locally (this mount) to avoid duplicate toasts from polling
  const localGenerationRef = useRef(false);

  const fetchLesson = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const course = await res.json();
      const found = course.lessons.find((l: LessonDetail) => l.id === lessonId);
      if (!found) throw new Error("Lesson not found");
      setLesson(found);
      setCourseNav({
        title: course.title,
        lessons: course.lessons.map((l: LessonDetail & { completedAt?: string | null }) => ({
          id: l.id,
          title: l.title,
          orderIndex: l.orderIndex,
          status: l.status,
          completedAt: l.completedAt,
          isSupplementary: l.isSupplementary,
        })),
        edges: (course.edges ?? []).map((e: { fromLessonId: string; toLessonId: string }) => ({
          fromLessonId: e.fromLessonId,
          toLessonId: e.toLessonId,
        })),
      });

      // Sync generation state from backend status
      if (!localGenerationRef.current) {
        const lessonAge = Date.now() - new Date(found.updatedAt).getTime();
        if (found.status === "generating" && lessonAge < STALE_THRESHOLD_MS) {
          setGenerating(true);
        } else if (found.status !== "generating") {
          setGenerating(false);
        }

        const activeQuiz = found.quizzes?.[0];
        if (activeQuiz?.status === "generating") {
          const quizAge = Date.now() - new Date(activeQuiz.createdAt).getTime();
          if (quizAge < STALE_THRESHOLD_MS) {
            setGeneratingQuiz(true);
          }
        } else if (activeQuiz?.status !== "generating") {
          setGeneratingQuiz(false);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(t("lesson:failedToLoadLesson"));
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, t]);

  useEffect(() => {
    if (!hydrated) return;
    fetchLesson();
  }, [hydrated, fetchLesson]);

  // Poll for generation completion when generating
  useEffect(() => {
    if (!generating && !generatingQuiz) return;
    if (localGenerationRef.current) return; // local generation handles its own updates

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (!res.ok) return;
        const course = await res.json();
        const found = course.lessons?.find((l: LessonDetail) => l.id === lessonId);
        if (!found) return;

        if (generating && found.status !== "generating") {
          setGenerating(false);
          setLesson(found);
          if (found.contentJson) {
            toast.success(t("lesson:lessonContentGenerated"));
          }
        }

        const activeQuiz = found.quizzes?.[0];
        if (generatingQuiz && activeQuiz?.status !== "generating") {
          setGeneratingQuiz(false);
          setLesson(found);
          if (activeQuiz?.status === "ready") {
            toast.success(t("lesson:quizGenerated"));
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [generating, generatingQuiz, courseId, lessonId, t]);

  // Alt+Left/Right keyboard shortcuts for prev/next lesson
  useEffect(() => {
    if (!courseNav) return;
    const sorted = [...courseNav.lessons].sort((a, b) => a.orderIndex - b.orderIndex);
    const currentIdx = sorted.findIndex((l) => l.id === lessonId);

    function handleKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft" && currentIdx > 0) {
        e.preventDefault();
        router.push(`/courses/${courseId}/lessons/${sorted[currentIdx - 1].id}`);
      } else if (e.key === "ArrowRight" && currentIdx < sorted.length - 1) {
        e.preventDefault();
        router.push(`/courses/${courseId}/lessons/${sorted[currentIdx + 1].id}`);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [courseNav, lessonId, courseId, router]);

  async function handleGenerate() {
    if (!hasAnyApiKey || !lesson || generating) return;
    setGenerating(true);
    localGenerationRef.current = true;
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
    } finally {
      localGenerationRef.current = false;
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
  const mobilePanelHeightClass =
    mobilePanelHeight === "peek"
      ? "h-[30svh]"
      : mobilePanelHeight === "full"
        ? "h-[92svh]"
        : "h-[58svh]";

  return (
    <div className="fixed inset-0 bg-background flex flex-col" data-testid="lesson-page-wrapper">
      <header className="border-b shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          {courseNav ? (
            <LessonBreadcrumbs
              courseId={courseId}
              courseName={courseNav.title}
              currentLessonId={lessonId}
              lessons={courseNav.lessons}
              edges={courseNav.edges}
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => router.push(`/courses/${courseId}`)}
              className="shrink-0"
            >
              &larr; <span className="hidden sm:inline">{t("lesson:courseOverview")}</span>
            </Button>
          )}
          <div className="flex-1 min-w-0" />
          {/* Desktop buttons */}
          <div className="hidden md:inline-flex"><ThemeToggle /></div>
          <div className="hidden md:inline-flex"><UserMenu /></div>
          {hasContent && (
            <>
              <Button
                variant={chatSidebarOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  if (!chatSidebarOpen) setScratchpadOpen(false);
                  if (!chatSidebarOpen) setMobilePanelHeight("half");
                  setChatSidebarOpen(!chatSidebarOpen);
                }}
                title={t("lesson:toggleChat")}
                className="hidden md:inline-flex"
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
                  if (!scratchpadOpen) setMobilePanelHeight("half");
                  setScratchpadOpen(!scratchpadOpen);
                }}
                title={t("lesson:toggleScratchpad")}
                className="hidden md:inline-flex"
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
          {/* Mobile overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0 md:hidden">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {hasContent && (
                <>
                  <DropdownMenuItem onClick={() => {
                    if (!chatSidebarOpen) setScratchpadOpen(false);
                    if (!chatSidebarOpen) setMobilePanelHeight("half");
                    setChatSidebarOpen(!chatSidebarOpen);
                  }}>
                    {t("lesson:chat")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    if (!scratchpadOpen) setChatSidebarOpen(false);
                    if (!scratchpadOpen) setMobilePanelHeight("half");
                    setScratchpadOpen(!scratchpadOpen);
                  }}>
                    {t("lesson:scratchpad")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div
        className={`flex-1 min-h-0 ${(scratchpadOpen || chatSidebarOpen) && hasContent ? "flex overflow-y-auto md:overflow-hidden" : "overflow-y-auto"}`}
        data-testid="lesson-scroll-container"
      >
          <main
            data-testid="lesson-main"
            className={
              (scratchpadOpen || chatSidebarOpen) && hasContent
                ? "flex-1 md:w-3/5 lg:w-1/2 md:overflow-y-auto px-6 pt-8 pb-4"
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
                <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                  <div className="min-w-0">
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
                      <div className="flex items-center justify-between flex-wrap gap-2">
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
                      <div className="flex items-center justify-between flex-wrap gap-2">
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
            <>
              <aside
                className={`fixed inset-x-0 bottom-0 z-50 md:hidden ${mobilePanelHeightClass}`}
                data-testid={scratchpadOpen ? "scratchpad-aside" : "chat-aside"}
              >
                <div className="h-full rounded-t-xl border border-b-0 bg-background shadow-2xl flex flex-col overflow-hidden">
                  <div className="shrink-0 border-b px-3 py-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="mx-auto h-1.5 w-12 rounded-full bg-muted"
                      aria-label="Resize panel"
                      onClick={() =>
                        setMobilePanelHeight((prev) =>
                          prev === "peek" ? "half" : prev === "half" ? "full" : "peek"
                        )
                      }
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setMobilePanelHeight("peek")}
                      >
                        30%
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setMobilePanelHeight("half")}
                      >
                        60%
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setMobilePanelHeight("full")}
                      >
                        90%
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1">
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
                  </div>
                </div>
              </aside>

              <aside
                className="hidden md:relative md:inset-auto md:z-auto md:w-2/5 lg:w-1/2 shrink-0 h-full md:block"
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
            </>
          )}
      </div>
    </div>
  );
}
