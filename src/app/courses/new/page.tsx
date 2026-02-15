"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppStore, useHasAnyApiKey } from "@/stores/appStore";
import { useHydrated } from "@/stores/useHydrated";
import { useApiHeaders } from "@/hooks/useApiHeaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { GeneratingSpinner, TriviaSlideshow } from "@/components/generation";
import {
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";

function NewCourseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const hasAnyApiKey = useHasAnyApiKey();
  const generationModel = useAppStore((s) => s.generationModel);
  const language = useAppStore((s) => s.language);
  const apiHeaders = useApiHeaders();
  const { t } = useTranslation(["courseNew", "common"]);

  // Pre-fill from search params (used by follow-up course recommendations)
  const prefillTopic = searchParams.get("topic");
  const prefillDescription = searchParams.get("description");
  const prefillDifficulty = searchParams.get("difficulty");
  const prefillFocusAreas = searchParams.get("focusAreas");
  const isPreFilled = !!prefillTopic;

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState(prefillTopic || "");
  const [description, setDescription] = useState(prefillDescription || "");
  const [focusInput, setFocusInput] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>(() => {
    if (prefillFocusAreas) {
      try {
        return JSON.parse(prefillFocusAreas);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [lessonCount, setLessonCount] = useState<string>("");
  const [difficulty, setDifficulty] = useState(prefillDifficulty || "intermediate");
  const [passThreshold, setPassThreshold] = useState(() => {
    const prefill = searchParams.get("passThreshold");
    return prefill ? Math.round(parseFloat(prefill) * 100) : 80;
  });
  const [noLessonCanFail, setNoLessonCanFail] = useState(() => {
    const prefill = searchParams.get("noLessonCanFail");
    return prefill ? prefill === "true" : true;
  });
  const [lessonFailureThreshold, setLessonFailureThreshold] = useState(() => {
    const prefill = searchParams.get("lessonFailureThreshold");
    return prefill ? Math.round(parseFloat(prefill) * 100) : 50;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingCourseId, setGeneratingCourseId] = useState<string | null>(null);

  function addFocusArea() {
    const trimmed = focusInput.trim();
    if (trimmed && !focusAreas.includes(trimmed)) {
      setFocusAreas((prev) => [...prev, trimmed]);
      setFocusInput("");
    }
  }

  function removeFocusArea(area: string) {
    setFocusAreas((prev) => prev.filter((a) => a !== area));
  }

  async function handleGenerate() {
    if (!hasAnyApiKey) {
      router.push("/setup");
      return;
    }
    if (!topic.trim()) {
      toast.error(t("courseNew:pleaseEnterTopic"));
      return;
    }

    setGenerating(true);
    setGeneratingCourseId(null);
    requestNotificationPermission();

    try {
      // Step 1: Create the course in the database
      const createRes = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic,
          description: description || t("courseNew:defaultDescription", { topic }),
          topic,
          focusAreas,
          targetLessonCount: lessonCount ? parseInt(lessonCount) : 10,
          difficulty,
          language,
          passThreshold: passThreshold / 100,
          noLessonCanFail,
          lessonFailureThreshold: lessonFailureThreshold / 100,
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create course");
      }

      const course = await createRes.json();
      setGeneratingCourseId(course.id);

      // Step 2: Generate the course structure with AI
      const genRes = await fetch("/api/generate/course", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          courseId: course.id,
          topic,
          description: description || t("courseNew:defaultDetailedDescription", { topic }),
          focusAreas,
          lessonCount: lessonCount ? parseInt(lessonCount) : undefined,
          difficulty,
          model: generationModel,
        }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || "Failed to generate course structure");
      }

      toast.success(t("courseNew:courseGenerated"));
      sendNotification(
        t("generation:courseReady"),
        t("generation:courseReadyBody"),
        `/courses/${course.id}`
      );
      router.push(`/courses/${course.id}`);
    } catch (err) {
      console.error("Course generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate course");
      sendNotification(
        t("generation:generationFailed"),
        t("generation:generationFailedBody", { title: topic })
      );
    } finally {
      setGenerating(false);
      setGeneratingCourseId(null);
    }
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            &larr; {t("common:back")}
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("courseNew:createNewCourse")}</h1>
            <p className="text-sm text-muted-foreground">{t("courseNew:stepOf", { step, total: 2 })}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {isPreFilled && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            {t("courseNew:prefilledFromRecommendation", {
              defaultValue: "Pre-filled from a course completion recommendation. Adjust any fields before generating.",
            })}
          </div>
        )}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("courseNew:courseTopicTitle")}</CardTitle>
              <CardDescription>
                {t("courseNew:courseTopicDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">{t("courseNew:topicLabel")}</Label>
                <Input
                  id="topic"
                  placeholder={t("courseNew:topicPlaceholder")}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("courseNew:descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("courseNew:descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="focus">{t("courseNew:focusAreasLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="focus"
                    placeholder={t("courseNew:focusAreasPlaceholder")}
                    value={focusInput}
                    onChange={(e) => setFocusInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFocusArea();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addFocusArea} type="button">
                    {t("common:add")}
                  </Button>
                </div>
                {focusAreas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {focusAreas.map((area) => (
                      <Badge
                        key={area}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeFocusArea(area)}
                      >
                        {area} &times;
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!topic.trim()}>
                  {t("common:next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("courseNew:courseConfigTitle")}</CardTitle>
              <CardDescription>
                {t("courseNew:courseConfigDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="difficulty">{t("courseNew:difficultyLabel")}</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">
                      <div>
                        <span>{t("courseNew:beginner")}</span>
                        <p className="text-xs text-muted-foreground font-normal">
                          {t("courseNew:beginnerDescription")}
                        </p>
                      </div>
                    </SelectItem>
                    <SelectItem value="intermediate">
                      <div>
                        <span>{t("courseNew:intermediate")}</span>
                        <p className="text-xs text-muted-foreground font-normal">
                          {t("courseNew:intermediateDescription")}
                        </p>
                      </div>
                    </SelectItem>
                    <SelectItem value="advanced">
                      <div>
                        <span>{t("courseNew:advanced")}</span>
                        <p className="text-xs text-muted-foreground font-normal">
                          {t("courseNew:advancedDescription")}
                        </p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lessons">{t("courseNew:lessonCountLabel")}</Label>
                <Input
                  id="lessons"
                  type="number"
                  min={3}
                  max={30}
                  placeholder={t("courseNew:lessonCountPlaceholder")}
                  value={lessonCount}
                  onChange={(e) => setLessonCount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("courseNew:lessonCountNote")}
                </p>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "\u25BC" : "\u25B6"} {t("courseNew:advancedSettings")}
                </button>

                {showAdvanced && (
                  <div className="space-y-6 rounded-lg border p-4">
                    <div className="space-y-2">
                      <Label>{t("courseNew:passThresholdLabel")}</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[passThreshold]}
                          onValueChange={([val]) => setPassThreshold(val)}
                          min={50}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-sm font-mono w-12 text-right">{passThreshold}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t("courseNew:passThresholdNote")}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t("courseNew:noLessonCanFailLabel")}</Label>
                        <p className="text-xs text-muted-foreground">{t("courseNew:noLessonCanFailNote")}</p>
                      </div>
                      <Switch
                        checked={noLessonCanFail}
                        onCheckedChange={setNoLessonCanFail}
                      />
                    </div>

                    {noLessonCanFail && (
                      <div className="space-y-2">
                        <Label>{t("courseNew:lessonFailureThresholdLabel")}</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[lessonFailureThreshold]}
                            onValueChange={([val]) => setLessonFailureThreshold(val)}
                            min={20}
                            max={80}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-sm font-mono w-12 text-right">{lessonFailureThreshold}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("courseNew:lessonFailureThresholdNote")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="font-medium text-sm">{t("courseNew:courseSummary")}</p>
                <p className="text-sm"><strong>{t("courseNew:topicSummary")}</strong> {topic}</p>
                {description && <p className="text-sm"><strong>{t("courseNew:descriptionSummary")}</strong> {description}</p>}
                {focusAreas.length > 0 && (
                  <p className="text-sm"><strong>{t("courseNew:focusSummary")}</strong> {focusAreas.join(", ")}</p>
                )}
                <p className="text-sm"><strong>{t("courseNew:difficultySummary")}</strong> {difficulty}</p>
                <p className="text-sm">
                  <strong>{t("courseNew:lessonsSummary")}</strong> {lessonCount || t("courseNew:aiWillSuggest")}
                </p>
                {showAdvanced && (
                  <>
                    <p className="text-sm"><strong>{t("courseNew:passThresholdSummary")}</strong> {passThreshold}%</p>
                    <p className="text-sm"><strong>{t("courseNew:noLessonCanFailSummary")}</strong> {noLessonCanFail ? t("common:yes") : t("common:no")}</p>
                    {noLessonCanFail && (
                      <p className="text-sm"><strong>{t("courseNew:lessonFailureThresholdSummary")}</strong> {lessonFailureThreshold}%</p>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={generating}>
                  {t("common:back")}
                </Button>
                <Button onClick={handleGenerate} disabled={generating || !hasAnyApiKey}>
                  {generating ? (
                    <GeneratingSpinner />
                  ) : (
                    t("courseNew:generateCourse")
                  )}
                </Button>
                {!hasAnyApiKey && (
                  <p className="text-xs text-muted-foreground">
                    {t("common:apiKeyRequiredHint")}
                  </p>
                )}
              </div>

              {generating && (
                <div className="flex flex-col items-center gap-2 mt-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("generation:browseAwayCourseMessage")}
                  </p>
                  {generatingCourseId && (
                    <TriviaSlideshow courseId={generatingCourseId} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function NewCoursePage() {
  return (
    <Suspense>
      <NewCourseForm />
    </Suspense>
  );
}
