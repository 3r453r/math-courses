"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./ScoreBar";

interface TimelineEntry {
  date: string;
  score: number;
  courseTitle: string;
  lessonTitle: string;
  quizGeneration: number;
}

interface ScoreTimelineProps {
  timeline: TimelineEntry[];
}

export function ScoreTimeline({ timeline }: ScoreTimelineProps) {
  const { t } = useTranslation("progress");

  if (timeline.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("noScoreHistory")}
      </p>
    );
  }

  // Show most recent first
  const sorted = [...timeline].reverse();

  return (
    <div className="space-y-1">
      {sorted.map((entry, i) => {
        const date = new Date(entry.date);
        const formatted = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        const time = date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={`${entry.date}-${i}`}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            {/* Date column */}
            <div className="w-20 shrink-0 text-right">
              <p className="text-xs font-medium tabular-nums">{formatted}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {time}
              </p>
            </div>

            {/* Timeline dot + line */}
            <div className="relative flex flex-col items-center">
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 ${
                  entry.score >= 0.8
                    ? "border-emerald-500 bg-emerald-500/20"
                    : entry.score >= 0.5
                      ? "border-amber-500 bg-amber-500/20"
                      : "border-red-500 bg-red-500/20"
                }`}
              />
              {i < sorted.length - 1 && (
                <div className="absolute top-3 h-8 w-px bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {entry.lessonTitle}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {entry.courseTitle}
              </p>
            </div>

            {/* Score + generation */}
            <div className="flex items-center gap-2 shrink-0">
              <ScoreBar score={entry.score} showLabel className="w-24" />
              {entry.quizGeneration > 1 && (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {t("generation", { num: entry.quizGeneration })}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
