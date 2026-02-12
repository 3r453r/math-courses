export interface CourseStructure {
  title: string;
  description: string;
  suggestedLessonCount: number;
  lessons: LessonOutline[];
  edges: CourseEdgeOutline[];
}

export interface LessonOutline {
  title: string;
  summary: string;
  orderIndex: number;
  prerequisites: number[]; // orderIndex values this lesson depends on
  keyTopics: string[];
  estimatedDifficulty: "introductory" | "foundational" | "intermediate" | "advanced";
}

export interface CourseEdgeOutline {
  from: number; // orderIndex of prerequisite lesson
  to: number; // orderIndex of dependent lesson
  relationship: "prerequisite" | "recommended" | "related";
}

export type CourseStatus = "draft" | "generating" | "ready";
export type LessonStatus = "pending" | "generating" | "ready" | "regenerating";
export type Difficulty = "beginner" | "intermediate" | "advanced";
