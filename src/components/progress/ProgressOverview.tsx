"use client";

import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface GlobalStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  overallAverageScore: number | null;
  totalLessonsCompleted: number;
  totalLessons: number;
}

interface ProgressOverviewProps {
  global: GlobalStats;
}

export function ProgressOverview({ global }: ProgressOverviewProps) {
  const { t } = useTranslation("progress");

  const stats = [
    {
      label: t("coursesInProgress"),
      value: global.inProgressCourses,
      accent: "border-l-amber-500",
    },
    {
      label: t("coursesCompleted"),
      value: global.completedCourses,
      accent: "border-l-emerald-500",
    },
    {
      label: t("lessonsCompleted"),
      value: `${global.totalLessonsCompleted}/${global.totalLessons}`,
      accent: "border-l-blue-500",
    },
    {
      label: t("overallAverageScore"),
      value:
        global.overallAverageScore !== null
          ? `${Math.round(global.overallAverageScore * 100)}%`
          : "\u2014",
      accent: "border-l-violet-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`border-l-4 ${stat.accent} py-4`}
        >
          <CardContent className="py-0">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stat.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
