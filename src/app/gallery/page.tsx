"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  filters: { topics: string[]; subjects: string[]; difficulties: string[] };
}

export default function GalleryPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation(["gallery", "common"]);

  const [data, setData] = useState<GalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloningToken, setCloningToken] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [topic, setTopic] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), sort });
      if (search) params.set("search", search);
      if (subject !== "all") params.set("subject", subject);
      if (topic !== "all") params.set("topic", topic);
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
  }, [page, sort, search, subject, topic, difficulty]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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

      <main className="container mx-auto px-4 py-8">
        <GalleryFilters
          search={search}
          onSearchChange={setSearch}
          subject={subject}
          onSubjectChange={(v) => { setSubject(v); setPage(1); }}
          topic={topic}
          onTopicChange={(v) => { setTopic(v); setPage(1); }}
          difficulty={difficulty}
          onDifficultyChange={(v) => { setDifficulty(v); setPage(1); }}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          subjects={data?.filters.subjects ?? []}
          topics={data?.filters.topics ?? []}
          difficulties={data?.filters.difficulties ?? []}
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t("gallery:loading")}</p>
          </div>
        ) : !data || data.items.length === 0 ? (
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
                  onClick={() => setPage((p) => p - 1)}
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
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("gallery:pagination.next")}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
