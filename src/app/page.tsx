"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import { useHydrated } from "@/stores/useHydrated";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CourseWithCount {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: string;
  status: string;
  createdAt: string;
  _count: { lessons: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const apiKey = useAppStore((s) => s.apiKey);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation(["dashboard", "common"]);

  useEffect(() => {
    if (!hydrated) return;
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchCourses();
  }, [hydrated, apiKey, router]);

  async function fetchCourses() {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCourse(courseId: string) {
    if (!confirm(t("common:confirmDeleteCourse"))) {
      return;
    }
    try {
      await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      console.error("Failed to delete course:", err);
    }
  }

  function statusVariant(status: string): "default" | "secondary" | "outline" {
    switch (status) {
      case "ready": return "default";
      case "generating": return "secondary";
      default: return "outline";
    }
  }

  if (!hydrated || !apiKey) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("dashboard:title")}</h1>
            <p className="text-sm text-muted-foreground">{t("dashboard:subtitle")}</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium"
              onClick={() => setLanguage(language === "en" ? "pl" : "en")}
            >
              {language === "en" ? "PL" : "EN"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/setup")}>
              {t("common:settings")}
            </Button>
            <Button onClick={() => router.push("/courses/new")}>
              {t("dashboard:newCourse")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("dashboard:loadingCourses")}</p>
          </div>
        ) : courses.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle>{t("dashboard:welcomeTitle")}</CardTitle>
              <CardDescription>
                {t("dashboard:welcomeDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => router.push("/courses/new")}>
                {t("dashboard:createFirstCourse")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/courses/${course.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                    <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{t("common:lessonCount", { count: course._count.lessons })}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="capitalize">{course.difficulty}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourse(course.id);
                      }}
                    >
                      {t("common:delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
