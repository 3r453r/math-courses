"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { LANGUAGE_NAMES } from "@/lib/ai/prompts/languageInstruction";

interface GalleryItem {
  shareToken: string;
  starCount: number;
  cloneCount: number;
  tags: string;
  featuredAt: string | null;
  course: {
    title: string;
    description: string;
    topic: string;
    subject: string;
    difficulty: string;
    language: string;
    _count: { lessons: number };
    user: { name: string | null };
  };
}

interface GalleryResponse {
  items: GalleryItem[];
  featured: GalleryItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: { subjects: string[]; difficulties: string[]; languages: string[] };
}

function GalleryLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

function GalleryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useTranslation(["gallery", "common"]);

  const apiHeaders = useApiHeaders();

  const [data, setData] = useState<GalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloningToken, setCloningToken] = useState<string | null>(null);
  const [translatingToken, setTranslatingToken] = useState<string | null>(null);

  // Read filter state from URL
  const search = searchParams.get("search") ?? "";
  const subjectsParam = searchParams.get("subjects") ?? "";
  const selectedSubjects = subjectsParam ? subjectsParam.split(",") : [];
  const language = searchParams.get("language") ?? "all";
  const difficulty = searchParams.get("difficulty") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  // Debounce search — local state for input, URL updated after delay
  const [searchInput, setSearchInput] = useState(search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep searchInput in sync when URL changes externally (e.g. back button)
  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  function updateParams(updates: Record<string, string | null>, push = false) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === "all" || (k === "page" && v === "1") || (k === "subjects" && v === "")) {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (push) {
      router.push(url);
    } else {
      router.replace(url);
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateParams({ search: value, page: null });
    }, 300);
  }

  function handleFilterChange(key: string, value: string) {
    updateParams({ [key]: value, page: null });
  }

  function handleSubjectsChange(values: string[]) {
    updateParams({ subjects: values.join(","), page: null });
  }

  function handlePageChange(newPage: number) {
    updateParams({ page: String(newPage) }, true);
  }

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), sort });
      if (search) params.set("search", search);
      if (selectedSubjects.length > 0) params.set("subjects", selectedSubjects.join(","));
      if (language !== "all") params.set("language", language);
      if (difficulty !== "all") params.set("difficulty", difficulty);

      const res = await fetch(`/api/gallery?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch gallery:", err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, subjectsParam, language, difficulty]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  async function handleClone(shareToken: string) {
    if (!session?.user) {
      router.push("/login?callbackUrl=/gallery");
      return;
    }

    setCloningToken(shareToken);
    try {
      const res = await fetch("/api/courses/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });

      if (res.ok) {
        const { id } = await res.json();
        toast.success(t("gallery:card.cloned"));
        router.push(`/courses/${id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to clone");
      }
    } catch {
      toast.error("Failed to clone course");
    } finally {
      setCloningToken(null);
    }
  }

  async function handleTranslate(shareToken: string, targetLanguage: string) {
    if (!session?.user) {
      router.push("/login?callbackUrl=/gallery");
      return;
    }

    const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
    setTranslatingToken(shareToken);
    try {
      const res = await fetch(`/api/courses/_/regenerate-language`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ targetLanguage, shareToken }),
      });

      if (res.ok) {
        const { id } = await res.json();
        toast.success(t("gallery:card.translated", { language: langName }));
        router.push(`/courses/${id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to translate");
      }
    } catch {
      toast.error("Failed to translate course");
    } finally {
      setTranslatingToken(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <GalleryFilters
        search={searchInput}
        onSearchChange={handleSearchChange}
        selectedSubjects={selectedSubjects}
        onSubjectsChange={handleSubjectsChange}
        language={language}
        onLanguageChange={(v) => handleFilterChange("language", v)}
        difficulty={difficulty}
        onDifficultyChange={(v) => handleFilterChange("difficulty", v)}
        sort={sort}
        onSortChange={(v) => handleFilterChange("sort", v)}
        subjects={data?.filters.subjects ?? []}
        languages={data?.filters.languages ?? []}
        difficulties={data?.filters.difficulties ?? []}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">{t("gallery:loading")}</p>
        </div>
      ) : !data || (data.items.length === 0 && data.featured.length === 0) ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">{t("gallery:empty")}</p>
        </div>
      ) : (
        <>
          {/* Featured section */}
          {data.featured.length > 0 && page === 1 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">{t("gallery:card.featured")}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.featured.map((item) => (
                  <GalleryCard
                    key={item.shareToken}
                    item={item}
                    onClone={handleClone}
                    cloning={cloningToken === item.shareToken}
                    isAuthenticated={!!session?.user}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {data.items.map((item) => (
              <GalleryCard
                key={item.shareToken}
                item={item}
                onClone={handleClone}
                cloning={cloningToken === item.shareToken}
                isAuthenticated={!!session?.user}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                {t("gallery:pagination.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("gallery:pagination.page", {
                  current: page,
                  total: data.totalPages,
                })}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                {t("gallery:pagination.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function GalleryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation(["gallery", "common"]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("gallery:title")}</h1>
            <p className="text-sm text-muted-foreground">{t("gallery:subtitle")}</p>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <UserMenu />
            {session?.user ? (
              <Button variant="outline" onClick={() => router.push("/")}>
                Dashboard
              </Button>
            ) : (
              <Button variant="outline" onClick={() => router.push("/login?callbackUrl=/gallery")}>
                Log in
              </Button>
            )}
          </div>
        </div>
      </header>

      <Suspense fallback={<GalleryLoadingSkeleton />}>
        <GalleryContent />
      </Suspense>
    </div>
  );
}
