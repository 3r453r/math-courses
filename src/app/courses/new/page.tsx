"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const { apiKey, generationModel } = useAppStore();

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
      toast.error("Please enter a topic");
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
          description: description || `A course on ${topic}`,
          topic,
          focusAreas,
          targetLessonCount: lessonCount ? parseInt(lessonCount) : 10,
          difficulty,
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
          description: description || `A comprehensive course on ${topic}`,
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

      toast.success("Course structure generated!");
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
            &larr; Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">Create New Course</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 2</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Course Topic</CardTitle>
              <CardDescription>
                What math topic do you want to learn? Be as specific or broad as you like.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Differential Geometry, Linear Algebra, Real Analysis"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe any specific aspects you want to focus on, your current level, or goals..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="focus">Focus Areas (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="focus"
                    placeholder="e.g., Riemannian metrics, Curvature tensors"
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
                    Add
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
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Course Configuration</CardTitle>
              <CardDescription>
                Set the difficulty level and number of lessons. Leave lesson count empty to let
                the AI suggest an optimal structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lessons">Number of Lessons (optional)</Label>
                <Input
                  id="lessons"
                  type="number"
                  min={3}
                  max={30}
                  placeholder="Leave empty for AI suggestion (typically 8-20)"
                  value={lessonCount}
                  onChange={(e) => setLessonCount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The AI will design a lesson dependency graph - not all lessons are sequential.
                  Some can be studied in parallel.
                </p>
              </div>

              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="font-medium text-sm">Course Summary</p>
                <p className="text-sm"><strong>Topic:</strong> {topic}</p>
                {description && <p className="text-sm"><strong>Description:</strong> {description}</p>}
                {focusAreas.length > 0 && (
                  <p className="text-sm"><strong>Focus:</strong> {focusAreas.join(", ")}</p>
                )}
                <p className="text-sm"><strong>Difficulty:</strong> {difficulty}</p>
                <p className="text-sm">
                  <strong>Lessons:</strong> {lessonCount || "AI will suggest"}
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <span className="animate-spin mr-2">&#9696;</span>
                      Generating Course Structure...
                    </>
                  ) : (
                    "Generate Course"
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
