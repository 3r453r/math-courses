"use client";

import { useEffect, useState } from "react";
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

interface CourseWithCount {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: string;
  status: string;
  createdAt: string;
  _count: { lessons: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const apiKey = useAppStore((s) => s.apiKey);
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) {
      router.push("/setup");
      return;
    }
    fetchCourses();
  }, [apiKey, router]);

  async function fetchCourses() {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCourse(courseId: string) {
    if (!confirm("Are you sure you want to delete this course? All lessons and progress will be lost.")) {
      return;
    }
    try {
      await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      console.error("Failed to delete course:", err);
    }
  }

  function statusVariant(status: string): "default" | "secondary" | "outline" {
    switch (status) {
      case "ready": return "default";
      case "generating": return "secondary";
      default: return "outline";
    }
  }

  if (!apiKey) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Math Courses</h1>
            <p className="text-sm text-muted-foreground">AI-powered math learning platform</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/setup")}>
              Settings
            </Button>
            <Button onClick={() => router.push("/courses/new")}>
              New Course
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Welcome to Math Courses</CardTitle>
              <CardDescription>
                Create your first course to get started. The AI will help you design a structured
                learning path with lessons, quizzes, and interactive visualizations.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => router.push("/courses/new")}>
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/courses/${course.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                    <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{course._count.lessons} lessons</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="capitalize">{course.difficulty}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourse(course.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
