"use client";

import { useEffect, useState, useMemo, use } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NotebookPanel } from "@/components/notebook";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { ExportDialog, ShareDialog } from "@/components/export";
import { evaluateCourseCompletion, DEFAULT_THRESHOLDS } from "@/lib/quiz/courseCompletion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface QuizAttemptInfo {
  id: string;
  score: number;
  recommendation: string;
}

interface QuizInfo {
  id: string;
  status: string;
  attempts: QuizAttemptInfo[];
}

interface Lesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  isSupplementary: boolean;
  weight: number;
  completedAt?: string | null;
  quizzes?: QuizInfo[];
}

interface Edge {
  id: string;
  fromLessonId: string;
  toLessonId: string;
  relationship: string;
}

interface DiagnosticAttemptInfo {
  id: string;
  score: number;
  recommendation: string;
  weakAreas: string;
}

interface DiagnosticInfo {
  id: string;
  status: string;
  attempts: DiagnosticAttemptInfo[];
}

interface CompletionSummaryInfo {
  id: string;
  completedAt: string;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  topic: string;
  focusAreas: string;
  difficulty: string;
  contextDoc?: string | null;
  passThreshold: number;
  noLessonCanFail: boolean;
  lessonFailureThreshold: number;
  status: string;
  lessons: Lesson[];
  edges: Edge[];
  diagnosticQuiz?: DiagnosticInfo | null;
  completionSummary?: CompletionSummaryInfo | null;
}

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { t } = useTranslation(["courseOverview", "common", "notebook", "export"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);
  const apiHeaders = useApiHeaders();
  const notebookOpen = useAppStore((s) => s.notebookOpen);
  const setNotebookOpen = useAppStore((s) => s.setNotebookOpen);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editingContextDoc, setEditingContextDoc] = useState(false);
  const [contextDocDraft, setContextDocDraft] = useState("");
  const [savingContextDoc, setSavingContextDoc] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingThresholds, setEditingThresholds] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [draftPassThreshold, setDraftPassThreshold] = useState(80);
  const [draftNoLessonCanFail, setDraftNoLessonCanFail] = useState(true);
  const [draftLessonFailureThreshold, setDraftLessonFailureThreshold] = useState(50);
  const [draftWeights, setDraftWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!hydrated) return;
    fetchCourse();
  }, [hydrated, courseId]);

  async function fetchCourse() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const data = await res.json();
      setCourse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseOverview:failedToLoadCourse"));
    } finally {
      setLoading(false);
    }
  }

  // Build adjacency info for a simple visual layout
  const lessonGraph = useMemo(() => {
    if (!course) return { layers: [] as Lesson[][], edgeList: [] as Edge[] };

    const lessons = course.lessons;
    const edges = course.edges;

    // Build in-degree map for topological sort / layer assignment
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();
    for (const l of lessons) {
      inDegree.set(l.id, 0);
      children.set(l.id, []);
    }
    for (const e of edges) {
      inDegree.set(e.toLessonId, (inDegree.get(e.toLessonId) ?? 0) + 1);
      children.get(e.fromLessonId)?.push(e.toLessonId);
    }

    // BFS layer assignment
    const layers: Lesson[][] = [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));
    const assigned = new Set<string>();
    let currentLayer = lessons.filter((l) => (inDegree.get(l.id) ?? 0) === 0);

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach((l) => assigned.add(l.id));
      const nextLayer: Lesson[] = [];
      for (const l of currentLayer) {
        for (const childId of children.get(l.id) ?? []) {
          if (assigned.has(childId)) continue;
          const remaining = edges.filter(
            (e) => e.toLessonId === childId && !assigned.has(e.fromLessonId)
          );
          if (remaining.length === 0) {
            const child = lessonMap.get(childId);
            if (child && !nextLayer.find((n) => n.id === childId)) {
              nextLayer.push(child);
            }
          }
        }
      }
      currentLayer = nextLayer;
    }

    // Add any unassigned lessons (orphans) to the last layer
    const orphans = lessons.filter((l) => !assigned.has(l.id));
    if (orphans.length > 0) {
      layers.push(orphans);
    }

    return { layers, edgeList: edges };
  }, [course]);

  function lessonNodeColor(lesson: Lesson) {
    if (lesson.completedAt) {
      return "bg-emerald-100 text-emerald-800 border-emerald-400";
    }
    const hasAttempt = lesson.quizzes?.[0]?.attempts?.[0];
    if (hasAttempt) {
      return "bg-amber-100 text-amber-800 border-amber-400";
    }
    switch (lesson.status) {
      case "ready":
        return "bg-green-50 text-green-800 border-green-300";
      case "generating":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("courseOverview:loadingCourse")}</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("common:error")}</CardTitle>
            <CardDescription>{error || t("courseOverview:courseNotFound")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>{t("courseOverview:backToDashboard")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSaveContextDoc() {
    setSavingContextDoc(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextDoc: contextDocDraft }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setCourse((prev) => prev ? { ...prev, contextDoc: contextDocDraft } : prev);
      setEditingContextDoc(false);
      toast.success(t("courseOverview:contextDocUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseOverview:failedToSave"));
    } finally {
      setSavingContextDoc(false);
    }
  }

  async function handleGenerateCompletionSummary() {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/completion-summary`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ model: generationModel }),
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      router.push(`/courses/${courseId}/completion`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  }

  function enterThresholdsEditMode() {
    setDraftPassThreshold(Math.round((course!.passThreshold ?? DEFAULT_THRESHOLDS.passThreshold) * 100));
    setDraftNoLessonCanFail(course!.noLessonCanFail ?? DEFAULT_THRESHOLDS.noLessonCanFail);
    setDraftLessonFailureThreshold(Math.round((course!.lessonFailureThreshold ?? DEFAULT_THRESHOLDS.lessonFailureThreshold) * 100));
    const weights: Record<string, number> = {};
    for (const l of course!.lessons) {
      weights[l.id] = l.weight ?? 1.0;
    }
    setDraftWeights(weights);
    setEditingThresholds(true);
  }

  function handleResetDefaults() {
    setDraftPassThreshold(Math.round(DEFAULT_THRESHOLDS.passThreshold * 100));
    setDraftNoLessonCanFail(DEFAULT_THRESHOLDS.noLessonCanFail);
    setDraftLessonFailureThreshold(Math.round(DEFAULT_THRESHOLDS.lessonFailureThreshold * 100));
    const weights: Record<string, number> = {};
    for (const l of course!.lessons) {
      weights[l.id] = 1.0;
    }
    setDraftWeights(weights);
  }

  async function handleSaveThresholds() {
    setSavingThresholds(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passThreshold: draftPassThreshold / 100,
          noLessonCanFail: draftNoLessonCanFail,
          lessonFailureThreshold: draftLessonFailureThreshold / 100,
          lessonWeights: draftWeights,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          passThreshold: draftPassThreshold / 100,
          noLessonCanFail: draftNoLessonCanFail,
          lessonFailureThreshold: draftLessonFailureThreshold / 100,
          lessons: prev.lessons.map((l) => ({
            ...l,
            weight: draftWeights[l.id] ?? l.weight,
          })),
        };
      });
      setEditingThresholds(false);
      toast.success(t("courseOverview:settingsSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseOverview:failedToSave"));
    } finally {
      setSavingThresholds(false);
    }
  }

  const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

  // Compute progress stats
  const completedLessons = course.lessons.filter((l) => l.completedAt).length;
  const totalLessons = course.lessons.length;

  const lessonScoresForCompletion = course.lessons.map((l) => ({
    lessonId: l.id,
    bestScore: l.quizzes?.[0]?.attempts?.[0]?.score ?? 0,
    weight: l.weight ?? 1.0,
  }));
  const completionResult = evaluateCourseCompletion(lessonScoresForCompletion, {
    passThreshold: course.passThreshold ?? 0.8,
    noLessonCanFail: course.noLessonCanFail ?? true,
    lessonFailureThreshold: course.lessonFailureThreshold ?? 0.5,
  });
  const coursePassed = completionResult.passed;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <header className="border-b shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            &larr; {t("common:back")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
          >
            <svg className="size-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {t("export:export")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
          >
            <svg className="size-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            {t("export:share")}
          </Button>
          <Button
            variant={notebookOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setNotebookOpen(!notebookOpen)}
            title="Toggle notebook"
          >
            <svg
              className="size-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            {t("notebook:notebook")}
          </Button>
          <Badge variant="outline" className="capitalize">
            {course.difficulty}
          </Badge>
        </div>
      </header>

      <div
        className={`flex-1 min-h-0 ${notebookOpen ? "flex" : "overflow-y-auto"}`}
        data-testid="course-scroll-container"
      >
          <main
            className={
              notebookOpen
                ? "w-1/2 overflow-y-auto px-4 py-8"
                : "flex-1 container mx-auto px-4 py-8"
            }
          >
            {/* Course info */}
            <div className="mb-8 flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <Badge key={area} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>

            {/* Context Document */}
            {course.contextDoc && (
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t("courseOverview:contextDocTitle")}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editingContextDoc) {
                          setEditingContextDoc(false);
                        } else {
                          setContextDocDraft(course.contextDoc || "");
                          setEditingContextDoc(true);
                        }
                      }}
                    >
                      {editingContextDoc ? t("common:cancel") : t("common:edit")}
                    </Button>
                  </div>
                  <CardDescription>
                    {t("courseOverview:contextDocDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {editingContextDoc ? (
                    <div className="space-y-3">
                      <Textarea
                        value={contextDocDraft}
                        onChange={(e) => setContextDocDraft(e.target.value)}
                        rows={15}
                        className="font-mono text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingContextDoc(false)}>
                          {t("common:cancel")}
                        </Button>
                        <Button size="sm" disabled={savingContextDoc} onClick={handleSaveContextDoc}>
                          {savingContextDoc ? t("common:saving") : t("common:save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <MathMarkdown content={course.contextDoc} className="text-sm" />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Prerequisite Assessment */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-base">{t("courseOverview:prerequisiteTitle")}</CardTitle>
                <CardDescription>
                  {t("courseOverview:prerequisiteDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {course.diagnosticQuiz?.attempts?.[0] ? (() => {
                  const attempt = course.diagnosticQuiz.attempts[0];
                  const pct = Math.round(attempt.score * 100);
                  const weakAreas: string[] = JSON.parse(attempt.weakAreas || "[]");
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold">{pct}%</span>
                          <Badge
                            variant={
                              attempt.score >= 0.8
                                ? "default"
                                : attempt.score >= 0.5
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {attempt.recommendation}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/courses/${courseId}/diagnostic`)}
                        >
                          {t("courseOverview:viewDetailsRetake")}
                        </Button>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {weakAreas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground mr-1">{t("courseOverview:weakAreas")}</span>
                          {weakAreas.map((area) => (
                            <Badge key={area} variant="destructive" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/courses/${courseId}/diagnostic`)}
                  >
                    {t("courseOverview:takeDiagnosticQuiz")}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Course Progress */}
            {course.status === "ready" && totalLessons > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t("courseOverview:courseProgress")}</CardTitle>
                    {!editingThresholds && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={enterThresholdsEditMode}
                      >
                        {t("courseOverview:editSettings")}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("courseOverview:lessonsCompleted", {
                          completed: completedLessons,
                          total: totalLessons,
                        })}
                      </span>
                      <span className="font-medium tabular-nums">
                        {totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0}%
                      </span>
                    </div>
                    <Progress
                      value={totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}
                      className="h-3"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("courseOverview:weightedScore")}
                      </span>
                      <span className={`font-bold tabular-nums ${
                        coursePassed ? "text-emerald-600" : "text-muted-foreground"
                      }`}>
                        {Math.round(completionResult.weightedScore * 100)}%
                        {" / "}
                        {Math.round((course.passThreshold ?? 0.8) * 100)}%
                      </span>
                    </div>
                    {completionResult.blockedByFailedLesson && (
                      <p className="text-sm text-amber-600">
                        {t("courseOverview:blockedByFailedLesson", {
                          count: completionResult.failedLessons.length,
                          threshold: Math.round((course.lessonFailureThreshold ?? 0.5) * 100),
                        })}
                      </p>
                    )}
                    {coursePassed && !course.completionSummary && (
                      <div className="pt-2">
                        <p className="text-sm text-emerald-600 font-medium mb-2">
                          {t("courseOverview:coursePassed")}
                        </p>
                        <Button
                          onClick={handleGenerateCompletionSummary}
                          disabled={generatingSummary || !hasAnyApiKey}
                        >
                          {generatingSummary
                            ? t("courseOverview:generatingSummary")
                            : t("courseOverview:generateCompletionSummary")}
                        </Button>
                        {!hasAnyApiKey && (
                          <p className="text-xs text-muted-foreground">
                            {t("common:apiKeyRequiredHint")}
                          </p>
                        )}
                      </div>
                    )}
                    {course.completionSummary && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/courses/${courseId}/completion`)}
                        >
                          {t("courseOverview:viewCompletionSummary")}
                        </Button>
                      </div>
                    )}

                    {/* Editable completion settings */}
                    {editingThresholds && (
                      <>
                        <Separator className="my-4" />
                        <div className="space-y-5">
                          {/* Pass Threshold */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>{t("courseOverview:passThresholdLabel")}</Label>
                              <span className="text-sm font-medium tabular-nums">{draftPassThreshold}%</span>
                            </div>
                            <Slider
                              value={[draftPassThreshold]}
                              onValueChange={([v]) => setDraftPassThreshold(v)}
                              min={50}
                              max={100}
                              step={5}
                            />
                            <p className="text-xs text-muted-foreground">{t("courseOverview:passThresholdNote")}</p>
                          </div>

                          {/* No Lesson Can Fail */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="no-lesson-fail-switch">{t("courseOverview:noLessonCanFailLabel")}</Label>
                              <Switch
                                id="no-lesson-fail-switch"
                                checked={draftNoLessonCanFail}
                                onCheckedChange={setDraftNoLessonCanFail}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">{t("courseOverview:noLessonCanFailNote")}</p>
                          </div>

                          {/* Lesson Failure Threshold — only shown when noLessonCanFail is on */}
                          {draftNoLessonCanFail && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>{t("courseOverview:lessonFailureThresholdLabel")}</Label>
                                <span className="text-sm font-medium tabular-nums">{draftLessonFailureThreshold}%</span>
                              </div>
                              <Slider
                                value={[draftLessonFailureThreshold]}
                                onValueChange={([v]) => setDraftLessonFailureThreshold(v)}
                                min={20}
                                max={80}
                                step={5}
                              />
                              <p className="text-xs text-muted-foreground">{t("courseOverview:lessonFailureThresholdNote")}</p>
                            </div>
                          )}

                          {/* Lesson Weights */}
                          <div className="space-y-2">
                            <Label>{t("courseOverview:lessonWeightsLabel")}</Label>
                            <div className="rounded-md border">
                              {course.lessons.map((lesson, idx) => (
                                <div
                                  key={lesson.id}
                                  className={`flex items-center gap-3 px-3 py-2 ${idx > 0 ? "border-t" : ""}`}
                                >
                                  <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                                    {lesson.orderIndex}
                                  </span>
                                  <span className="flex-1 text-sm truncate min-w-0">
                                    {lesson.title}
                                  </span>
                                  {lesson.quizzes?.[0]?.attempts?.[0] && (
                                    <Badge
                                      variant={
                                        lesson.quizzes[0].attempts[0].score >= 0.8
                                          ? "default"
                                          : lesson.quizzes[0].attempts[0].score >= 0.5
                                            ? "secondary"
                                            : "destructive"
                                      }
                                      className="text-[10px] shrink-0"
                                    >
                                      {Math.round(lesson.quizzes[0].attempts[0].score * 100)}%
                                    </Badge>
                                  )}
                                  <Input
                                    type="number"
                                    min={0.1}
                                    max={5.0}
                                    step={0.1}
                                    value={draftWeights[lesson.id] ?? 1.0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val) && val >= 0.1 && val <= 5.0) {
                                        setDraftWeights((prev) => ({ ...prev, [lesson.id]: Math.round(val * 10) / 10 }));
                                      }
                                    }}
                                    className="w-20 h-8 text-sm shrink-0"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex justify-between pt-2">
                            <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
                              {t("courseOverview:resetToDefaults")}
                            </Button>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setEditingThresholds(false)}>
                                {t("common:cancel")}
                              </Button>
                              <Button size="sm" disabled={savingThresholds} onClick={handleSaveThresholds}>
                                {savingThresholds ? t("courseOverview:savingSettings") : t("common:save")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lesson graph - layered layout */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{t("courseOverview:courseStructureTitle")}</CardTitle>
                <CardDescription>
                  {t("courseOverview:courseStructureDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lessonGraph.layers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {t("courseOverview:noLessonsYet")}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {lessonGraph.layers.map((layer, layerIdx) => (
                      <div key={layerIdx}>
                        {layerIdx > 0 && (
                          <div className="flex justify-center py-2">
                            <div className="text-muted-foreground text-xs">
                              &#x25BC;
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 justify-center">
                          {layer.map((lesson) => (
                            <button
                              key={lesson.id}
                              onClick={() =>
                                router.push(
                                  `/courses/${courseId}/lessons/${lesson.id}`
                                )
                              }
                              className={`
                                relative p-3 rounded-lg border-2 text-left
                                min-w-[200px] max-w-[280px]
                                transition-all hover:shadow-md hover:scale-[1.02]
                                ${lessonNodeColor(lesson)}
                              `}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-mono opacity-60">
                                  #{lesson.orderIndex}
                                </span>
                                <div className="flex items-center gap-1">
                                  {lesson.completedAt && (
                                    <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                  {lesson.isSupplementary && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {t("common:supplementary")}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="font-medium text-sm mt-1 leading-tight">
                                {lesson.title}
                              </p>
                              <p className="text-xs mt-1 opacity-70 line-clamp-2">
                                {lesson.summary}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lesson list */}
            <Card>
              <CardHeader>
                <CardTitle>{t("courseOverview:allLessons", { count: course.lessons.length })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {course.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() =>
                        router.push(`/courses/${courseId}/lessons/${lesson.id}`)
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-6">
                        {lesson.orderIndex}
                      </span>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lesson.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lesson.completedAt && (
                          <svg className="size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        {lesson.weight != null && lesson.weight !== 1.0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {t("courseOverview:weight")}: {lesson.weight}x
                          </Badge>
                        )}
                        {lesson.quizzes?.[0]?.attempts?.[0] && (
                          <Badge
                            variant={
                              lesson.quizzes[0].attempts[0].score >= 0.8
                                ? "default"
                                : lesson.quizzes[0].attempts[0].score >= 0.5
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs"
                          >
                            {t("courseOverview:quizScore", { score: Math.round(lesson.quizzes[0].attempts[0].score * 100) })}
                          </Badge>
                        )}
                        <Badge
                          variant={lesson.status === "ready" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {lesson.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>

          {notebookOpen && (
            <aside
              className="w-1/2 shrink-0"
              data-testid="notebook-aside"
            >
              <NotebookPanel
                courseId={courseId}
                onClose={() => setNotebookOpen(false)}
              />
            </aside>
          )}
      </div>

      <ExportDialog
        courseId={courseId}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
      <ShareDialog
        courseId={courseId}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </div>
  );
}
