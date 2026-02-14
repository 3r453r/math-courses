"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreBar } from "./ScoreBar";

interface WeakTopic {
  topic: string;
  frequency: number;
  latestScore: number;
}

interface CourseWeakTopics {
  title: string;
  weakTopics: WeakTopic[];
}

interface WeakTopicsSummaryProps {
  courses: CourseWeakTopics[];
}

export function WeakTopicsSummary({ courses }: WeakTopicsSummaryProps) {
  const { t } = useTranslation("progress");

  const hasAny = courses.some((c) => c.weakTopics.length > 0);

  if (!hasAny) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("noWeakTopics")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {courses
        .filter((c) => c.weakTopics.length > 0)
        .map((course) => (
          <Card key={course.title}>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">{course.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {course.weakTopics.map((wt) => (
                  <div
                    key={wt.topic}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5"
                  >
                    <Badge variant="destructive" className="text-[11px] shrink-0">
                      {wt.topic}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {t("weakTopicFrequency", { count: wt.frequency })}
                    </span>
                    <div className="flex-1" />
                    <ScoreBar
                      score={wt.latestScore}
                      showLabel
                      className="w-28"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
