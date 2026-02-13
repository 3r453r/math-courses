"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LessonContentRenderer } from "@/components/lesson/LessonContentRenderer";
import type { LessonContent } from "@/types/lesson";

interface QuizInfo {
  id: string;
  status: string;
  attempts: { id: string; score: number; recommendation: string }[];
}

interface LessonDetail {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  contentJson: string | null;
  isSupplementary: boolean;
  courseId: string;
  quizzes?: QuizInfo[];
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const router = useRouter();
  const { apiKey, generationModel } = useAppStore();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchLesson();
  }, [apiKey, lessonId, router]);

  async function fetchLesson() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const course = await res.json();
      const found = course.lessons.find((l: LessonDetail) => l.id === lessonId);
      if (!found) throw new Error("Lesson not found");
      setLesson(found);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lesson");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!apiKey || !lesson) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          courseId,
          model: generationModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate lesson");
      }
      toast.success("Lesson content generated!");
      await fetchLesson();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading lesson...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Lesson not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/courses/${courseId}`)}>
              Back to Course
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasContent = !!lesson.contentJson;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}`)}
          >
            &larr; Course Overview
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                Lesson {lesson.orderIndex}
              </span>
              <Badge
                variant={lesson.status === "ready" ? "default" : "outline"}
              >
                {lesson.status}
              </Badge>
              {lesson.isSupplementary && (
                <Badge variant="secondary">supplementary</Badge>
              )}
            </div>
            <h1 className="text-xl font-bold">{lesson.title}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {!hasContent ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Lesson Not Yet Generated</CardTitle>
              <CardDescription>
                {lesson.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Click below to generate the full lesson content using AI.
                This will create detailed explanations, visualizations,
                worked examples, and practice exercises.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <span className="animate-spin mr-2">&#9696;</span>
                    Generating Lesson Content...
                  </>
                ) : (
                  "Generate Lesson Content"
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{lesson.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {lesson.summary}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <LessonContentRenderer
              content={JSON.parse(lesson.contentJson!) as LessonContent}
            />

            {/* Quiz section */}
            <Card className="mt-8">
              <CardContent className="pt-6">
                {lesson.quizzes?.[0]?.attempts?.[0] ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">Lesson Quiz</p>
                        <p className="text-xs text-muted-foreground">
                          Score: {Math.round(lesson.quizzes[0].attempts[0].score * 100)}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          lesson.quizzes[0].attempts[0].score >= 0.8
                            ? "default"
                            : lesson.quizzes[0].attempts[0].score >= 0.5
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {lesson.quizzes[0].attempts[0].recommendation}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/courses/${courseId}/lessons/${lessonId}/quiz`
                        )
                      }
                    >
                      Review / Retake
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Ready to test your understanding?</p>
                      <p className="text-xs text-muted-foreground">
                        Take a quiz to check your grasp of this lesson&apos;s material.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/courses/${courseId}/lessons/${lessonId}/quiz`
                        )
                      }
                    >
                      Take Quiz
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
