"use client";

import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  className?: string;
  showLabel?: boolean;
}

export function ScoreBar({ score, className, showLabel }: ScoreBarProps) {
  const pct = Math.round(score * 100);
  const barColor =
    score >= 0.8
      ? "bg-emerald-500 dark:bg-emerald-400"
      : score >= 0.5
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-red-500 dark:bg-red-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
            barColor
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums font-medium text-muted-foreground w-9 text-right">
          {pct}%
        </span>
      )}
    </div>
  );
}
