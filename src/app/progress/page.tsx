"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useHydrated } from "@/stores/useHydrated";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ProgressOverview,
  CourseProgressCard,
  ScoreTimeline,
  WeakTopicsSummary,
} from "@/components/progress";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ProgressData {
  global: {
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    overallAverageScore: number | null;
    totalLessonsCompleted: number;
    totalLessons: number;
  };
  courses: Array<{
    id: string;
    title: string;
    topic: string;
    difficulty: string;
    progress: {
      completedLessons: number;
      totalLessons: number;
      percentComplete: number;
      averageScore: number | null;
      bestScore: number | null;
      isCompleted: boolean;
    };
    weakTopics: Array<{ topic: string; frequency: number; latestScore: number }>;
    scoreHistory: Array<{
      date: string;
      score: number;
      courseId: string;
      courseTitle: string;
      lessonTitle: string;
      quizGeneration: number;
    }>;
  }>;
  timeline: Array<{
    date: string;
    score: number;
    courseId: string;
    courseTitle: string;
    lessonTitle: string;
    quizGeneration: number;
  }>;
}

export default function ProgressPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation(["progress", "common"]);

  useEffect(() => {
    if (!hydrated) return;
    fetchProgress();
  }, [hydrated]);

  async function fetchProgress() {
    try {
      const res = await fetch("/api/progress");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            &larr; {t("progress:backToDashboard")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("progress:title")}</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("progress:loading")}</p>
          </div>
        ) : !data || data.global.totalCourses === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("progress:noCoursesYet")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <ProgressOverview global={data.global} />

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{t("progress:overview")}</TabsTrigger>
                <TabsTrigger value="history">{t("progress:scoreHistory")}</TabsTrigger>
                <TabsTrigger value="weak">{t("progress:weakTopics")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.courses.map((course) => (
                    <CourseProgressCard
                      key={course.id}
                      course={course}
                      onClick={() => router.push(`/courses/${course.id}`)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ScoreTimeline timeline={data.timeline} />
              </TabsContent>

              <TabsContent value="weak" className="mt-4">
                <WeakTopicsSummary
                  courses={data.courses.map((c) => ({
                    title: c.title,
                    weakTopics: c.weakTopics,
                  }))}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
