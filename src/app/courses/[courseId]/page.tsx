"use client";

import { useEffect, useState, useMemo, use } from "react";
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
import { Separator } from "@/components/ui/separator";

interface Lesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
  isSupplementary: boolean;
}

interface Edge {
  id: string;
  fromLessonId: string;
  toLessonId: string;
  relationship: string;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  topic: string;
  focusAreas: string;
  difficulty: string;
  status: string;
  lessons: Lesson[];
  edges: Edge[];
}

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const apiKey = useAppStore((s) => s.apiKey);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchCourse();
  }, [apiKey, courseId, router]);

  async function fetchCourse() {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      const data = await res.json();
      setCourse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course");
    } finally {
      setLoading(false);
    }
  }

  // Build adjacency info for a simple visual layout
  const lessonGraph = useMemo(() => {
    if (!course) return { layers: [] as Lesson[][], edgeList: [] as Edge[] };

    const lessons = course.lessons;
    const edges = course.edges;

    // Build in-degree map for topological sort / layer assignment
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();
    for (const l of lessons) {
      inDegree.set(l.id, 0);
      children.set(l.id, []);
    }
    for (const e of edges) {
      inDegree.set(e.toLessonId, (inDegree.get(e.toLessonId) ?? 0) + 1);
      children.get(e.fromLessonId)?.push(e.toLessonId);
    }

    // BFS layer assignment
    const layers: Lesson[][] = [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));
    const assigned = new Set<string>();
    let currentLayer = lessons.filter((l) => (inDegree.get(l.id) ?? 0) === 0);

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach((l) => assigned.add(l.id));
      const nextLayer: Lesson[] = [];
      for (const l of currentLayer) {
        for (const childId of children.get(l.id) ?? []) {
          if (assigned.has(childId)) continue;
          const remaining = edges.filter(
            (e) => e.toLessonId === childId && !assigned.has(e.fromLessonId)
          );
          if (remaining.length === 0) {
            const child = lessonMap.get(childId);
            if (child && !nextLayer.find((n) => n.id === childId)) {
              nextLayer.push(child);
            }
          }
        }
      }
      currentLayer = nextLayer;
    }

    // Add any unassigned lessons (orphans) to the last layer
    const orphans = lessons.filter((l) => !assigned.has(l.id));
    if (orphans.length > 0) {
      layers.push(orphans);
    }

    return { layers, edgeList: edges };
  }, [course]);

  function statusColor(status: string) {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-300";
      case "generating":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "pending":
        return "bg-gray-100 text-gray-600 border-gray-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading course...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || "Course not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const focusAreas = JSON.parse(course.focusAreas || "[]") as string[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            &larr; Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.description}</p>
          </div>
          <Badge variant="outline" className="capitalize">
            {course.difficulty}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Course info */}
        <div className="mb-8 flex flex-wrap gap-2">
          {focusAreas.map((area) => (
            <Badge key={area} variant="secondary">
              {area}
            </Badge>
          ))}
        </div>

        {/* Lesson graph - layered layout */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Course Structure</CardTitle>
            <CardDescription>
              Lessons are organized as a dependency graph. Click a lesson to view its content.
              Lessons in the same row can be studied in parallel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lessonGraph.layers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No lessons generated yet.
              </p>
            ) : (
              <div className="space-y-6">
                {lessonGraph.layers.map((layer, layerIdx) => (
                  <div key={layerIdx}>
                    {layerIdx > 0 && (
                      <div className="flex justify-center py-2">
                        <div className="text-muted-foreground text-xs">
                          &#x25BC;
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 justify-center">
                      {layer.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            router.push(
                              `/courses/${courseId}/lessons/${lesson.id}`
                            )
                          }
                          className={`
                            relative p-3 rounded-lg border-2 text-left
                            min-w-[200px] max-w-[280px]
                            transition-all hover:shadow-md hover:scale-[1.02]
                            ${statusColor(lesson.status)}
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-mono opacity-60">
                              #{lesson.orderIndex}
                            </span>
                            {lesson.isSupplementary && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                supplementary
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm mt-1 leading-tight">
                            {lesson.title}
                          </p>
                          <p className="text-xs mt-1 opacity-70 line-clamp-2">
                            {lesson.summary}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lesson list */}
        <Card>
          <CardHeader>
            <CardTitle>All Lessons ({course.lessons.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {course.lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() =>
                    router.push(`/courses/${courseId}/lessons/${lesson.id}`)
                  }
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <span className="text-xs font-mono text-muted-foreground w-6">
                    {lesson.orderIndex}
                  </span>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lesson.summary}
                    </p>
                  </div>
                  <Badge
                    variant={lesson.status === "ready" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {lesson.status}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
