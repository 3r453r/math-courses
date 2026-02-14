"use client";

import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  averageScore: number | null;
  isCompleted: boolean;
}

interface CourseProgressCardProps {
  course: {
    id: string;
    title: string;
    topic: string;
    difficulty: string;
    progress: CourseProgress;
  };
  onClick?: () => void;
}

export function CourseProgressCard({ course, onClick }: CourseProgressCardProps) {
  const { t } = useTranslation("progress");
  const { progress } = course;

  return (
    <Card
      className={`transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">
            {course.title}
          </CardTitle>
          {progress.isCompleted && (
            <Badge variant="default" className="bg-emerald-600 text-white shrink-0">
              {t("coursesCompleted")}
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] capitalize">
            {course.topic}
          </Badge>
          <Badge variant="secondary" className="text-[10px] capitalize">
            {course.difficulty}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("lessonsCompletedOf", {
                completed: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </span>
            <span className="tabular-nums font-medium">
              {progress.percentComplete}%
            </span>
          </div>
          <Progress value={progress.percentComplete} className="h-2" />
          {progress.averageScore !== null && (
            <p className="text-xs text-muted-foreground">
              {t("averageScore", {
                score: Math.round(progress.averageScore * 100),
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
