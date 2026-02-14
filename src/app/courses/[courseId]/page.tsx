"use client";

import { useEffect, useState, useRef, useMemo, use } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPanel } from "@/components/notebook";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
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

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  topic: string;
  focusAreas: string;
  difficulty: string;
  contextDoc?: string | null;
  status: string;
  lessons: Lesson[];
  edges: Edge[];
  diagnosticQuiz?: DiagnosticInfo | null;
}

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { t } = useTranslation(["courseOverview", "common", "notebook"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const apiKey = useAppStore((s) => s.apiKey);
  const notebookOpen = useAppStore((s) => s.notebookOpen);
  const setNotebookOpen = useAppStore((s) => s.setNotebookOpen);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContextDoc, setEditingContextDoc] = useState(false);
  const [contextDocDraft, setContextDocDraft] = useState("");
  const [savingContextDoc, setSavingContextDoc] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchCourse();
  }, [hydrated, apiKey, courseId, router]);

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

  function statusColor(status: string) {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-300";
      case "generating":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "pending":
        return "bg-gray-100 text-gray-600 border-gray-300";
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

  const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

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
                                ${statusColor(lesson.status)}
                              `}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-mono opacity-60">
                                  #{lesson.orderIndex}
                                </span>
                                {lesson.isSupplementary && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {t("common:supplementary")}
                                  </Badge>
                                )}
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
    </div>
  );
}
