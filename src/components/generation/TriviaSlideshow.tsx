"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathMarkdown } from "@/components/lesson";

interface TriviaSlide {
  title: string;
  fact: string;
  funRating: "mind-blowing" | "cool" | "neat";
}

interface TriviaSlideshowProps {
  courseId: string;
  lessonId?: string;
}

const RATING_COLORS: Record<string, string> = {
  "mind-blowing": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cool: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  neat: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function TriviaSlideshow({ courseId, lessonId }: TriviaSlideshowProps) {
  const { t } = useTranslation("generation");
  const apiHeaders = useApiHeaders();
  const [slides, setSlides] = useState<TriviaSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [error, setError] = useState(false);

  async function fetchTrivia() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/generate/trivia", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ courseId, lessonId }),
      });
      if (!res.ok) throw new Error("Failed to fetch trivia");
      const data = await res.json();
      const newSlides: TriviaSlide[] = data.slides ?? [];
      setSlides((prev) => {
        const jumpTo = prev.length;
        setCurrentIndex(jumpTo);
        return [...prev, ...newSlides];
      });
      setBatchCount((b) => b + 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const ratingLabel = (rating: string) => {
    switch (rating) {
      case "mind-blowing":
        return t("mindBlowing");
      case "cool":
        return t("cool");
      case "neat":
        return t("neat");
      default:
        return rating;
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto mt-4 space-y-3">
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTrivia}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">&#9696;</span>
              {t("loadingTrivia")}
            </>
          ) : batchCount === 0 ? (
            t("generateTrivia")
          ) : (
            t("giveMoreTrivia")
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">
          {t("triviaError")}
        </p>
      )}

      {slides.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {slides[currentIndex].title}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={RATING_COLORS[slides[currentIndex].funRating]}
                >
                  {ratingLabel(slides[currentIndex].funRating)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              <MathMarkdown content={slides[currentIndex].fact} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              &larr;
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              {t("slideCounter", {
                current: currentIndex + 1,
                total: slides.length,
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))
              }
              disabled={currentIndex === slides.length - 1}
            >
              &rarr;
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
