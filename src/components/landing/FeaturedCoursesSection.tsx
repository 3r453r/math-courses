"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GalleryCard } from "@/components/gallery/GalleryCard";

interface GalleryItem {
  shareToken: string;
  starCount: number;
  cloneCount: number;
  tags: string;
  featuredAt: string | null;
  hasPreview?: boolean;
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

export function FeaturedCoursesSection() {
  const { t } = useTranslation(["login"]);
  const [courses, setCourses] = useState<GalleryItem[]>([]);

  useEffect(() => {
    fetch("/api/gallery?limit=6")
      .then((r) => r.json())
      .then((data) => {
        const featured: GalleryItem[] = data.featured ?? [];
        const withPreview = featured.filter((c) => c.hasPreview);
        setCourses(withPreview);
      })
      .catch(() => {});
  }, []);

  if (courses.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {t("login:featuredCourses.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("login:featuredCourses.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((item) => (
            <GalleryCard
              key={item.shareToken}
              item={item}
              onClone={() => {}}
              cloning={false}
              isAuthenticated={false}
            />
          ))}
        </div>
        <div className="text-center mt-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => (window.location.href = "/gallery")}
          >
            {t("login:featuredCourses.viewAll")}
          </Button>
        </div>
      </div>
    </section>
  );
}
