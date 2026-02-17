"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstallButton } from "@/components/InstallButton";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";

interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  averageScore: number | null;
  isCompleted: boolean;
}

interface CourseWithProgress {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: string;
  status: string;
  createdAt: string;
  _count: { lessons: number };
  progress: CourseProgress;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const { t } = useTranslation(["dashboard", "common", "login", "export"]);

  useEffect(() => {
    if (!hydrated) return;
    // Check access status before anything else
    fetch("/api/user/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.accessStatus === "pending") {
          router.push("/redeem");
          return;
        }
        if (data.accessStatus === "suspended") {
          router.push("/redeem");
          return;
        }
        fetchCourses();
      })
      .catch(() => {
        // If status check fails (e.g. not logged in), proceed normally
        fetchCourses();
      });
  }, [hydrated, router]);

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

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Import failed");
      }
      const result = await res.json();
      toast.success(t("export:importSuccess"));
      router.push(`/courses/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("export:importFailed"));
    } finally {
      setImporting(false);
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

  const stats = useMemo(() => {
    const completed = courses.filter((c) => c.progress.isCompleted).length;
    const inProgress = courses.filter(
      (c) => !c.progress.isCompleted && c.progress.completedLessons > 0
    ).length;
    const totalLessons = courses.reduce((sum, c) => sum + c.progress.totalLessons, 0);
    const completedLessons = courses.reduce((sum, c) => sum + c.progress.completedLessons, 0);
    return { completed, inProgress, totalLessons, completedLessons };
  }, [courses]);

  if (!hydrated) return null;

  const hasReadyCourses = courses.some((c) => c.status === "ready");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("dashboard:title")}</h1>
            <p className="text-sm text-muted-foreground">{t("dashboard:subtitle")}</p>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <InstallButton />
            <UserMenu />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-medium hidden md:inline-flex"
              onClick={() => setLanguage(language === "en" ? "pl" : "en")}
            >
              {language === "en" ? "PL" : "EN"}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
            />
            <div className="hidden md:flex gap-2 items-center">
              <Button variant="outline" onClick={() => router.push("/gallery")}>
                {t("dashboard:gallery")}
              </Button>
              {process.env.NEXT_PUBLIC_DISCORD_INVITE_URL && (
                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("dashboard:joinDiscord")}
                  </a>
                </Button>
              )}
              {hasReadyCourses && (
                <Button variant="outline" onClick={() => router.push("/progress")}>
                  {t("dashboard:viewProgress")}
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push("/setup")}>
                {t("common:settings")}
              </Button>
              <Button
                variant="outline"
                onClick={() => importRef.current?.click()}
                disabled={importing}
              >
                {importing ? t("export:importing") : t("export:importCourse")}
              </Button>
              <Button onClick={() => router.push("/courses/new")}>
                {t("dashboard:newCourse")}
              </Button>
            </div>
            <MobileMenu
              showProgress={hasReadyCourses}
              onImport={() => importRef.current?.click()}
              languageLabel={language === "en" ? "PL" : "EN"}
              onLanguageToggle={() => setLanguage(language === "en" ? "pl" : "en")}
            />
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
          <>
            {/* Summary stats */}
            {hasReadyCourses && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                <Card className="border-l-4 border-l-amber-500 py-4">
                  <CardContent className="py-0">
                    <p className="text-2xl font-bold tabular-nums">{stats.inProgress}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard:viewProgress")}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 py-4">
                  <CardContent className="py-0">
                    <p className="text-2xl font-bold tabular-nums">{stats.completed}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard:completedBadge")}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 py-4">
                  <CardContent className="py-0">
                    <p className="text-2xl font-bold tabular-nums">
                      {stats.completedLessons}/{stats.totalLessons}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("common:lessonCount", { count: stats.completedLessons })}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500 py-4">
                  <CardContent className="py-0">
                    <p className="text-2xl font-bold tabular-nums">{courses.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("common:lessonCount", { count: courses.length }).replace(/\d+/, "").trim() || "Total Courses"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Course grid */}
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
                      <div className="flex gap-1.5 shrink-0">
                        {course.progress.isCompleted && (
                          <Badge variant="default" className="bg-emerald-600 text-white">
                            {t("dashboard:completedBadge")}
                          </Badge>
                        )}
                        <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t("common:lessonCount", { count: course._count.lessons })}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="capitalize">{course.difficulty}</span>
                    </div>

                    {/* Progress bar */}
                    {course.status === "ready" && course.progress.totalLessons > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {t("dashboard:lessonsCompleted", {
                              completed: course.progress.completedLessons,
                              total: course.progress.totalLessons,
                            })}
                          </span>
                          <span className="tabular-nums">{course.progress.percentComplete}%</span>
                        </div>
                        <Progress value={course.progress.percentComplete} className="h-1.5" />
                        {course.progress.averageScore !== null && (
                          <p className="text-[11px] text-muted-foreground">
                            {t("dashboard:avgScore", {
                              score: Math.round(course.progress.averageScore * 100),
                            })}
                          </p>
                        )}
                      </div>
                    )}

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
          </>
        )}
      </main>
    </div>
  );
}
