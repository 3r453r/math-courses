"use client";

import { useEffect, useState, use } from "react";
import { useHydrated } from "@/stores/useHydrated";
import { useRouter } from "next/navigation";
import { LessonContentRenderer } from "@/components/lesson";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import type { LessonContent } from "@/types/lesson";
import { parseLessonContent } from "@/lib/content/parseLessonContent";

interface Lesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  contentJson: string | null;
  isSupplementary: boolean;
}

interface Edge {
  fromLessonId: string;
  toLessonId: string;
  relationship: string;
}

interface CourseData {
  title: string;
  description: string;
  topic: string;
  focusAreas: string;
  difficulty: string;
  contextDoc: string | null;
  lessons: Lesson[];
  edges: Edge[];
  completionSummary?: {
    narrativeMarkdown: string | null;
  } | null;
}

export default function PrintCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { t } = useTranslation(["export", "common"]);
  const router = useRouter();
  const hydrated = useHydrated();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    fetch(`/api/courses/${courseId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Course not found");
        return res.json();
      })
      .then(setCourse)
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [hydrated, courseId, router]);

  if (loading || !course) {
    return (
      <div className="flex items-center justify-center min-h-screen print:hidden">
        <p className="text-muted-foreground">{t("common:loading")}</p>
      </div>
    );
  }

  const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

  // Build prerequisite text per lesson
  const lessonIdToTitle = new Map<string, string>();
  for (const l of course.lessons) {
    lessonIdToTitle.set(l.id, l.title);
  }
  const prereqsByLesson = new Map<string, string[]>();
  for (const edge of course.edges) {
    if (edge.relationship === "prerequisite") {
      const existing = prereqsByLesson.get(edge.toLessonId) ?? [];
      existing.push(lessonIdToTitle.get(edge.fromLessonId) ?? "?");
      prereqsByLesson.set(edge.toLessonId, existing);
    }
  }

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-background border-b p-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          &larr; {t("common:back")}
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => window.print()}>
            {t("export:printPdf")}
          </Button>
        </div>
      </div>

      {/* Printable content */}
      <div className="print-content max-w-4xl mx-auto px-8 py-12 print:px-0 print:py-0">
        {/* Title page */}
        <div className="print:break-after-page mb-12 print:mb-0 print:flex print:flex-col print:justify-center print:min-h-[80vh]">
          <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
          <p className="text-xl text-muted-foreground mb-6">{course.description}</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>{t("export:topic")}:</strong> {course.topic}</p>
            <p><strong>{t("export:difficulty")}:</strong> {course.difficulty}</p>
            {focusAreas.length > 0 && (
              <p><strong>{t("export:focusAreas")}:</strong> {focusAreas.join(", ")}</p>
            )}
            <p><strong>{t("export:lessons")}:</strong> {course.lessons.length}</p>
          </div>
        </div>

        {/* Context document */}
        {course.contextDoc && (
          <div className="print:break-after-page mb-12">
            <h2 className="text-2xl font-bold mb-4">{t("export:contextDocument")}</h2>
            <MathMarkdown content={course.contextDoc} />
          </div>
        )}

        {/* Table of contents */}
        <div className="print:break-after-page mb-12">
          <h2 className="text-2xl font-bold mb-4">{t("export:tableOfContents")}</h2>
          <ol className="space-y-2">
            {course.lessons.map((lesson) => (
              <li key={lesson.id} className="text-sm flex gap-2">
                <span className="font-mono text-muted-foreground w-8 shrink-0">
                  {lesson.orderIndex}.
                </span>
                <span>{lesson.title}</span>
                {lesson.isSupplementary && (
                  <span className="text-xs text-muted-foreground italic">
                    ({t("export:supplementary")})
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Lessons */}
        {course.lessons.map((lesson) => {
          let content: LessonContent | null = null;
          if (lesson.contentJson) {
            try {
              content = parseLessonContent(lesson.contentJson);
            } catch {
              // skip
            }
          }

          return (
            <div key={lesson.id} className="print:break-before-page mb-16 print:mb-0">
              <h2 className="text-2xl font-bold mb-1">
                {lesson.orderIndex}. {lesson.title}
              </h2>
              <p className="text-muted-foreground mb-4">{lesson.summary}</p>

              {prereqsByLesson.has(lesson.id) && (
                <p className="text-xs text-muted-foreground mb-4">
                  <strong>{t("export:prerequisites")}:</strong>{" "}
                  {prereqsByLesson.get(lesson.id)!.join(", ")}
                </p>
              )}

              {content ? (
                <LessonContentRenderer content={content} />
              ) : (
                <p className="text-muted-foreground italic">
                  {t("export:noContentGenerated")}
                </p>
              )}
            </div>
          );
        })}

        {/* Completion summary */}
        {course.completionSummary?.narrativeMarkdown && (
          <div className="print:break-before-page mb-16">
            <h2 className="text-2xl font-bold mb-4">{t("export:completionSummary")}</h2>
            <MathMarkdown content={course.completionSummary.narrativeMarkdown} />
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            font-size: 11pt;
            color: black;
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-content {
            max-width: none;
            padding: 0;
          }
          /* Page margins */
          @page {
            margin: 2cm;
            size: A4;
          }
          /* Avoid breaking inside important elements */
          h1, h2, h3, h4 {
            break-after: avoid;
          }
          pre, blockquote, table, figure, .katex-display {
            break-inside: avoid;
          }
          /* Ensure KaTeX renders in black */
          .katex {
            color: black !important;
          }
        }
      `}</style>
    </>
  );
}
