"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";

export function HeroSection() {
  const { t } = useTranslation(["login"]);
  const [socialProof, setSocialProof] = useState<{
    show: boolean;
    totalCourses: number;
    totalRatings: number;
    averageRating: number | null;
  }>({ show: false, totalCourses: 0, totalRatings: 0, averageRating: null });

  useEffect(() => {
    Promise.all([
      fetch("/api/site-config/public").then((r) => r.json()),
      fetch("/api/gallery/stats").then((r) => r.json()),
    ])
      .then(([config, stats]) => {
        if (config.showGalleryStatsOnPricing === "true" && stats.totalCourses > 0) {
          setSocialProof({
            show: true,
            totalCourses: stats.totalCourses,
            totalRatings: stats.totalRatings,
            averageRating: stats.averageRating,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative py-20 md:py-28 text-center overflow-hidden">
      {/* Hero background pattern (white-bg PNG — multiply removes white, hidden in dark mode) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-no-repeat bg-center bg-cover mix-blend-multiply dark:hidden"
        aria-hidden="true"
        style={{ backgroundImage: "url('/hero-background.png')", filter: "contrast(3) saturate(1.5)" }}
      />
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,102,241,0.07), transparent 70%)",
        }}
      />

      <div className="max-w-3xl mx-auto space-y-6">
        <BrandMark size={64} className="mx-auto mb-2 rounded-2xl" />
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-brand-from to-brand-to bg-clip-text text-transparent">
          {t("login:hero.title")}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          {t("login:hero.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            size="lg"
            className="text-base px-8 text-white border-0 hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            onClick={() => {
              document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {t("login:hero.getStarted")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base px-8"
            onClick={() => (window.location.href = "/gallery")}
          >
            {t("login:hero.browseGallery")}
          </Button>
        </div>

        {socialProof.show && (
          <div className="flex justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{socialProof.totalCourses}</p>
              <p>{t("login:socialProof.courses", { count: socialProof.totalCourses })}</p>
            </div>
            {socialProof.totalRatings > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{socialProof.totalRatings}</p>
                <p>{t("login:socialProof.ratings", { count: socialProof.totalRatings })}</p>
              </div>
            )}
            {socialProof.averageRating && (
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{socialProof.averageRating}</p>
                <p>{t("login:socialProof.averageRating")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
