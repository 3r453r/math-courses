"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { computeDagLayers } from "@/lib/course/dagLayers";

interface NavLesson {
  id: string;
  title: string;
  orderIndex: number;
  status: string;
  completedAt?: string | null;
  isSupplementary?: boolean;
}

interface NavEdge {
  fromLessonId: string;
  toLessonId: string;
}

interface LessonNavDropdownProps {
  courseId: string;
  currentLessonId: string;
  lessons: NavLesson[];
  edges: NavEdge[];
}

export function LessonNavDropdown({
  courseId,
  currentLessonId,
  lessons,
  edges,
}: LessonNavDropdownProps) {
  const router = useRouter();
  const { t } = useTranslation(["lesson"]);

  const currentLesson = lessons.find((l) => l.id === currentLessonId);
  const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIdx = sorted.findIndex((l) => l.id === currentLessonId);
  const prevLesson = currentIdx > 0 ? sorted[currentIdx - 1] : null;
  const nextLesson = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;

  const layers = computeDagLayers(lessons, edges);

  function navigateToLesson(lessonId: string) {
    router.push(`/courses/${courseId}/lessons/${lessonId}`);
  }

  function statusIcon(lesson: NavLesson) {
    if (lesson.id === currentLessonId) {
      return <span className="size-4 inline-flex items-center justify-center text-primary font-bold text-xs">●</span>;
    }
    if (lesson.completedAt) {
      return (
        <svg className="size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      );
    }
    return <span className="size-4 inline-flex items-center justify-center text-muted-foreground text-xs">○</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              disabled={!prevLesson}
              onClick={() => prevLesson && navigateToLesson(prevLesson.id)}
              aria-label={t("lesson:prevLesson")}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          {prevLesson && (
            <TooltipContent side="bottom">
              <p className="text-xs">{prevLesson.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-2 max-w-[200px] sm:max-w-[300px]">
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              #{currentLesson?.orderIndex}
            </span>
            <span className="truncate text-sm font-medium">
              {currentLesson?.title}
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 max-h-[60vh] overflow-y-auto" align="start">
          {layers.map((layer, layerIdx) => (
            <DropdownMenuGroup key={layerIdx}>
              {layerIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t("lesson:layer", { number: layerIdx + 1 })}
              </DropdownMenuLabel>
              {layer.map((lesson) => (
                <DropdownMenuItem
                  key={lesson.id}
                  onClick={() => navigateToLesson(lesson.id)}
                  className={lesson.id === currentLessonId ? "bg-accent" : ""}
                >
                  <div className="flex items-center gap-2 w-full min-w-0">
                    {statusIcon(lesson)}
                    <span className="text-xs font-mono text-muted-foreground shrink-0 w-5 text-right">
                      {lesson.orderIndex}
                    </span>
                    <span className="truncate text-sm">{lesson.title}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              disabled={!nextLesson}
              onClick={() => nextLesson && navigateToLesson(nextLesson.id)}
              aria-label={t("lesson:nextLesson")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          {nextLesson && (
            <TooltipContent side="bottom">
              <p className="text-xs">{nextLesson.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
