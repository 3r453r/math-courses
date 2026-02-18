"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { useAppStore, useHasAnyApiKey } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CourseSuggestion {
  title: string;
  description: string;
  topic: string;
  rationale: string;
  connectedCourses: string[];
  focusAreas: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedLessons: number;
}

export function CourseDiscovery() {
  const router = useRouter();
  const { t } = useTranslation(["dashboard", "common"]);
  const apiHeaders = useApiHeaders();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);

  const [state, setState] = useState<
    "idle" | "loading" | "results" | "error"
  >("idle");
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGenerate() {
    if (!hasAnyApiKey) {
      router.push("/setup");
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/generate/suggest-course", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ model: generationModel }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setSuggestions(data.suggestions);
      setState("results");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate suggestions";
      setErrorMessage(msg);
      setState("error");
      toast.error(msg);
    }
  }

  function handleCreate(suggestion: CourseSuggestion) {
    const params = new URLSearchParams({
      topic: suggestion.topic,
      description: suggestion.description,
      difficulty: suggestion.difficulty,
      focusAreas: JSON.stringify(suggestion.focusAreas),
      source: "discovery",
    });
    router.push(`/courses/new?${params.toString()}`);
  }

  function difficultyVariant(
    diff: string
  ): "default" | "secondary" | "outline" {
    switch (diff) {
      case "advanced":
        return "default";
      case "intermediate":
        return "secondary";
      default:
        return "outline";
    }
  }

  if (state === "idle") {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("dashboard:discovery.title")}
          </CardTitle>
          <CardDescription>
            {t("dashboard:discovery.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={!hasAnyApiKey}>
            {t("dashboard:discovery.generate")}
          </Button>
          {!hasAnyApiKey && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("common:apiKeyRequiredHint")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (state === "loading") {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("dashboard:discovery.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {t("dashboard:discovery.loading")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {t("dashboard:discovery.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button variant="outline" onClick={handleGenerate}>
            {t("dashboard:discovery.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // state === "results"
  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t("dashboard:discovery.resultsTitle")}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            {t("dashboard:discovery.regenerate")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState("idle");
              setSuggestions([]);
            }}
          >
            {t("dashboard:discovery.dismiss")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {suggestions.map((suggestion, i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">
                  {suggestion.title}
                </CardTitle>
                <Badge
                  variant={difficultyVariant(suggestion.difficulty)}
                  className="shrink-0"
                >
                  {suggestion.difficulty}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {suggestion.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t("dashboard:discovery.whyThisCourse")}
                </p>
                <p className="text-sm italic">{suggestion.rationale}</p>
              </div>

              {suggestion.connectedCourses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.connectedCourses.map((course) => (
                    <Badge key={course} variant="outline" className="text-xs">
                      {course}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  ~{suggestion.estimatedLessons}{" "}
                  {t("dashboard:discovery.lessons")}
                </span>
              </div>

              <div className="mt-auto pt-2">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => handleCreate(suggestion)}
                >
                  {t("dashboard:discovery.createCourse")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
