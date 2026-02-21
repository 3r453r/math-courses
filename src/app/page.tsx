"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Search, X } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useHydrated } from "@/stores/useHydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstallButton } from "@/components/InstallButton";
import { UserMenu } from "@/components/UserMenu";
import { MobileMenu } from "@/components/MobileMenu";
import { BrandMark } from "@/components/BrandMark";
import { CourseDiscovery } from "@/components/dashboard/CourseDiscovery";

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
  language: string;
  status: string;
  subject: string;
  isBookmarked: boolean;
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
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    data: string;
    createdAt: string;
  }>>([]);
  const { t } = useTranslation(["dashboard", "common", "login", "export"]);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Ref so filter re-fetch effect can skip the initial run
  const didInitialFetch = useRef(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterDifficulty !== "all") params.set("difficulty", filterDifficulty);
      if (filterSubject !== "all") params.set("subject", filterSubject);

      const res = await fetch(`/api/courses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? data);
        if (data.filters) {
          setAvailableSubjects(data.filters.subjects ?? []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterStatus, filterDifficulty, filterSubject, sortBy]);

  useEffect(() => {
    if (!hydrated) return;
    // Check access status and ToS acceptance before anything else
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
        if (data.tosAccepted === false) {
          router.push("/terms/accept?callbackUrl=/");
          return;
        }
        didInitialFetch.current = true;
        fetchCourses();
        fetchNotifications();
      })
      .catch(() => {
        // If status check fails (e.g. not logged in), proceed normally
        didInitialFetch.current = true;
        fetchCourses();
      });
  }, [hydrated, router]);

  // Re-fetch when filters change, but only after the initial fetch has run
  useEffect(() => {
    if (!didInitialFetch.current) return;
    fetchCourses();
  }, [fetchCourses]);

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

  async function handleToggleBookmark(e: React.MouseEvent, courseId: string, current: boolean) {
    e.stopPropagation();
    // Optimistic update
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, isBookmarked: !current } : c))
    );
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBookmarked: !current }),
      });
      if (!res.ok) throw new Error("Failed");
      // Re-fetch to get server-side sorted order
      fetchCourses();
    } catch {
      // Revert on error
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, isBookmarked: current } : c))
      );
    }
  }

  const hasActiveFilters =
    search !== "" || filterStatus !== "all" || filterDifficulty !== "all" || filterSubject !== "all";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatus("all");
    setFilterDifficulty("all");
    setFilterSubject("all");
    setSortBy("newest");
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/user/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently ignore
    }
  }

  async function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // silently ignore
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
          <div className="flex items-center gap-3">
            <BrandMark size={40} className="rounded-lg shrink-0 -m-1" />
            <div>
              <h1 className="text-2xl font-bold">{t("dashboard:title")}</h1>
              <p className="text-sm text-muted-foreground">{t("dashboard:subtitle")}</p>
            </div>
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
        {/* Notification banners */}
        {notifications.map((notif) => {
          const data = (() => { try { return JSON.parse(notif.data); } catch { return {}; } })();
          if (notif.type === "gallery_listed") {
            return (
              <div
                key={notif.id}
                className="mb-4 rounded-lg border border-brand-from/30 bg-brand-from/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <p className="text-sm">
                  {t("common:notifications.galleryListed", { title: data.courseTitle ?? "" })}
                </p>
                <div className="flex gap-2 shrink-0">
                  {data.shareToken && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/preview/${data.shareToken}`)}
                    >
                      {t("common:notifications.viewInGallery")}
                    </Button>
                  )}
                  {data.courseId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/courses/${data.courseId}`)}
                    >
                      {t("common:notifications.claimAuthorship")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissNotification(notif.id)}
                  >
                    {t("common:notifications.dismiss")}
                  </Button>
                </div>
              </div>
            );
          }
          return null;
        })}

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

            {/* Course discovery */}
            {courses.filter((c) => c.status === "ready").length >= 2 && (
              <CourseDiscovery />
            )}

            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9"
                  placeholder={t("dashboard:searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder={t("dashboard:allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard:allStatuses")}</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="generating">Generating</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder={t("dashboard:allDifficulties")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard:allDifficulties")}</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>

              {availableSubjects.length > 0 && (
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder={t("dashboard:allSubjects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("dashboard:allSubjects")}</SelectItem>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("dashboard:sortNewest")}</SelectItem>
                  <SelectItem value="oldest">{t("dashboard:sortOldest")}</SelectItem>
                  <SelectItem value="updated">{t("dashboard:sortUpdated")}</SelectItem>
                  <SelectItem value="alpha">{t("dashboard:sortAlpha")}</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  {t("dashboard:clearFilters")}
                </Button>
              )}
            </div>

            {/* Course grid */}
            {courses.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-muted-foreground">{t("dashboard:noCoursesFound")}</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {t("dashboard:clearFilters")}
                  </Button>
                )}
              </div>
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
                      <div className="flex gap-1.5 shrink-0 items-center">
                        {course.isBookmarked && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {t("dashboard:pinnedBadge")}
                          </Badge>
                        )}
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
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => handleToggleBookmark(e, course.id, course.isBookmarked)}
                            >
                              {course.isBookmarked
                                ? <BookmarkCheck className="h-4 w-4 text-primary" />
                                : <Bookmark className="h-4 w-4" />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {course.isBookmarked ? t("dashboard:unbookmarkTooltip") : t("dashboard:bookmarkTooltip")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
          </>
        )}
      </main>
    </div>
  );
}
