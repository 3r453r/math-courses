"use client";

import { useEffect, useState, useMemo, use } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { computeDagLayers } from "@/lib/course/dagLayers";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";
import { Languages } from "lucide-react";
import { parseLessonContent } from "@/lib/content/parseLessonContent";

interface SharedLesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  contentJson: string | null;
  isSupplementary: boolean;
  weight: number;
  completedAt: string | null;
  quizzes: Array<{
    id: string;
    questionsJson: string;
    questionCount: number;
    status: string;
  }>;
}

interface SharedEdge {
  id: string;
  fromLessonId: string;
  toLessonId: string;
  relationship: string;
}

interface SharedCourse {
  title: string;
  description: string;
  topic: string;
  focusAreas: string;
  difficulty: string;
  language: string;
  contextDoc: string | null;
  status: string;
  authorName: string | null;
  lessons: SharedLesson[];
  edges: SharedEdge[];
  completionSummary: {
    narrativeMarkdown: string | null;
    completedAt: string;
  } | null;
}

interface SharedData {
  shareToken: string;
  course: SharedCourse;
}

export default function SharedCoursePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);
  const { t } = useTranslation(["export", "common"]);
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [translating, setTranslating] = useState(false);
  const apiHeaders = useApiHeaders();

  useEffect(() => {
    fetch(`/api/shared/${shareToken}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load shared course");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shareToken]);

  const lessonLayers = useMemo(() => {
    if (!data) return [];
    return computeDagLayers(data.course.lessons, data.course.edges);
  }, [data]);

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch("/api/courses/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to clone course");
      }
      const result = await res.json();
      toast.success(t("export:courseCloned"));
      window.location.href = `/courses/${result.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone");
    } finally {
      setCloning(false);
    }
  }

  async function handleTranslate(targetLanguage: string) {
    setTranslating(true);
    try {
      const res = await fetch(`/api/courses/_/regenerate-language`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ targetLanguage, shareToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to translate course");
      }
      const result = await res.json();
      const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
      toast.success(t("export:courseTranslated", { language: langName }));
      window.location.href = `/courses/${result.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to translate");
    } finally {
      setTranslating(false);
    }
  }

  const translateLanguages = data
    ? Object.entries(LANGUAGE_NAMES).filter(([code]) => code !== data.course.language)
    : [];

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
            <CardDescription>{error || t("export:shareNotFound")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const course = data.course;
  const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{course.title}</h1>
              <Badge variant="outline">{t("export:sharedCourse")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{course.description}</p>
            {course.authorName && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("export:sharedBy", { name: course.authorName })}
              </p>
            )}
          </div>
          <ThemeToggle />
          <Button onClick={handleClone} disabled={cloning || translating}>
            {cloning ? t("export:cloning") : translating ? t("export:translating") : t("export:cloneToMyCourses")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={cloning || translating}>
                <Languages className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              {translateLanguages.map(([code, name]) => (
                <DropdownMenuItem key={code} onClick={() => handleTranslate(code)}>
                  {name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant="outline" className="capitalize">
            {course.difficulty}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Course info */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Badge variant="secondary">{course.topic}</Badge>
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
              <CardTitle className="text-base">{t("export:contextDocument")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MathMarkdown content={course.contextDoc} className="text-sm" />
            </CardContent>
          </Card>
        )}

        {/* Course structure graph */}
        {lessonLayers.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t("export:courseStructure")}</CardTitle>
              <CardDescription>
                {t("export:courseStructureDescription", { count: course.lessons.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {lessonLayers.map((layer, layerIdx) => (
                  <div key={layerIdx}>
                    {layerIdx > 0 && (
                      <div className="flex justify-center py-2">
                        <div className="text-muted-foreground text-xs">&#x25BC;</div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 justify-center">
                      {layer.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            setExpandedLesson(
                              expandedLesson === lesson.id ? null : lesson.id
                            )
                          }
                          className={`
                            p-3 rounded-lg border-2 text-left
                            min-w-[200px] max-w-[280px]
                            transition-all hover:shadow-md hover:scale-[1.02]
                            ${
                              lesson.completedAt
                                ? "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700"
                                : lesson.status === "ready"
                                  ? "bg-green-50 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                                  : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                            }
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-mono opacity-60">
                              #{lesson.orderIndex}
                            </span>
                            {lesson.completedAt && (
                              <svg
                                className="size-4 text-emerald-600 dark:text-emerald-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
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
            </CardContent>
          </Card>
        )}

        {/* Expanded lesson content */}
        {expandedLesson && (() => {
          const lesson = course.lessons.find((l) => l.id === expandedLesson);
          if (!lesson?.contentJson) return null;
          let content;
          try {
            content = parseLessonContent(lesson.contentJson);
          } catch {
            return null;
          }
          return (
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{lesson.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedLesson(null)}
                  >
                    {t("common:close")}
                  </Button>
                </div>
                <CardDescription>{lesson.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.learningObjectives?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      {t("export:learningObjectives")}
                    </h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {content.learningObjectives.map(
                        (obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
                {content.sections?.map(
                  (section: Record<string, unknown>, i: number) => (
                    <div key={i}>
                      {section.type === "text" && (
                        <MathMarkdown
                          content={section.content as string}
                          className="text-sm"
                        />
                      )}
                      {section.type === "math" && (
                        <div className="my-3">
                          <MathMarkdown
                            content={`$$${section.latex}$$`}
                            className="text-sm"
                          />
                          {typeof section.explanation === "string" && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {section.explanation}
                            </p>
                          )}
                        </div>
                      )}
                      {section.type === "definition" && (
                        <div className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 my-3">
                          <p className="font-semibold text-sm">
                            {section.term as string}
                          </p>
                          <MathMarkdown
                            content={section.definition as string}
                            className="text-sm"
                          />
                        </div>
                      )}
                      {section.type === "theorem" && (
                        <div className="border-l-4 border-purple-300 dark:border-purple-700 pl-4 my-3">
                          <p className="font-semibold text-sm">
                            {section.name as string}
                          </p>
                          <MathMarkdown
                            content={section.statement as string}
                            className="text-sm"
                          />
                        </div>
                      )}
                      {section.type === "code_block" && (
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{section.code as string}</code>
                        </pre>
                      )}
                      {section.type === "visualization" && (
                        <div className="bg-muted/50 rounded-lg p-4 my-3 text-sm text-muted-foreground italic">
                          [{t("export:visualization")}: {section.caption as string}]
                        </div>
                      )}
                    </div>
                  )
                )}
                {content.keyTakeaways?.length > 0 && (
                  <div>
                    <Separator className="my-4" />
                    <h4 className="font-semibold text-sm mb-2">
                      {t("export:keyTakeaways")}
                    </h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {content.keyTakeaways.map(
                        (takeaway: string, i: number) => (
                          <li key={i}>{takeaway}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* All lessons list */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("export:allLessons", { count: course.lessons.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {course.lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() =>
                    setExpandedLesson(
                      expandedLesson === lesson.id ? null : lesson.id
                    )
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
                  <div className="flex items-center gap-2 shrink-0">
                    {lesson.completedAt && (
                      <svg
                        className="size-4 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
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
    </div>
  );
}
