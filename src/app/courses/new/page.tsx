"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
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
import { toast } from "sonner";

export default function NewCoursePage() {
  const router = useRouter();
  const { apiKey, generationModel, language } = useAppStore();
  const { t } = useTranslation(["courseNew", "common"]);

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [focusInput, setFocusInput] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [lessonCount, setLessonCount] = useState<string>("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [generating, setGenerating] = useState(false);

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
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    if (!topic.trim()) {
      toast.error(t("courseNew:pleaseEnterTopic"));
      return;
    }

    setGenerating(true);

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
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create course");
      }

      const course = await createRes.json();

      // Step 2: Generate the course structure with AI
      const genRes = await fetch("/api/generate/course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
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
      router.push(`/courses/${course.id}`);
    } catch (err) {
      console.error("Course generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate course");
    } finally {
      setGenerating(false);
    }
  }

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
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  {t("common:back")}
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <span className="animate-spin mr-2">&#9696;</span>
                      {t("courseNew:generatingCourseStructure")}
                    </>
                  ) : (
                    t("courseNew:generateCourse")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
