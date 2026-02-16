"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ChevronRight, Home } from "lucide-react";
import { LessonNavDropdown } from "./LessonNavDropdown";

interface BreadcrumbLesson {
  id: string;
  title: string;
  orderIndex: number;
  status: string;
  completedAt?: string | null;
  isSupplementary?: boolean;
}

interface BreadcrumbEdge {
  fromLessonId: string;
  toLessonId: string;
}

interface LessonBreadcrumbsProps {
  courseId: string;
  courseName: string;
  currentLessonId: string;
  lessons: BreadcrumbLesson[];
  edges: BreadcrumbEdge[];
}

export function LessonBreadcrumbs({
  courseId,
  courseName,
  currentLessonId,
  lessons,
  edges,
}: LessonBreadcrumbsProps) {
  const { t } = useTranslation(["lesson"]);

  return (
    <nav className="flex items-center gap-1 min-w-0" aria-label="Breadcrumb">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={t("lesson:home")}
      >
        <Home className="size-4" />
      </Link>

      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />

      <Link
        href={`/courses/${courseId}`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline"
        title={courseName}
      >
        {courseName}
      </Link>

      <ChevronRight className="size-3.5 text-muted-foreground shrink-0 hidden sm:block" />

      <LessonNavDropdown
        courseId={courseId}
        currentLessonId={currentLessonId}
        lessons={lessons}
        edges={edges}
      />
    </nav>
  );
}
