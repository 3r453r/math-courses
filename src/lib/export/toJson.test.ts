import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toExportJson } from "./toJson";
import type { FullCourseData } from "./courseData";

// ---------------------------------------------------------------------------
// Helpers to build mock FullCourseData matching the Prisma return shape
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-15T12:00:00.000Z");
const LATER = new Date("2026-01-16T08:30:00.000Z");

function baseCourse(
  overrides: Partial<FullCourseData> = {}
): FullCourseData {
  return {
    id: "course-1",
    userId: "user-1",
    title: "Linear Algebra Fundamentals",
    description: "An introduction to vectors and matrices.",
    topic: "Linear Algebra",
    focusAreas: JSON.stringify(["Vectors", "Matrices"]),
    targetLessonCount: 5,
    difficulty: "intermediate",
    language: "en",
    contextDoc: "Pedagogical context for the course.",
    passThreshold: 0.8,
    noLessonCanFail: true,
    lessonFailureThreshold: 0.5,
    status: "active",
    clonedFromId: null,
    createdAt: NOW,
    updatedAt: NOW,
    lessons: [],
    edges: [],
    notes: [],
    diagnosticQuiz: null,
    completionSummary: null,
    shares: [],
    user: { id: "user-1", name: "Test", email: "test@test.com", emailVerified: null, image: null, encryptedApiKeys: null, createdAt: NOW, updatedAt: NOW },
    ...overrides,
  } as unknown as FullCourseData;
}

function makeLesson(
  overrides: Partial<FullCourseData["lessons"][number]> = {}
): FullCourseData["lessons"][number] {
  return {
    id: "lesson-1",
    courseId: "course-1",
    title: "Vectors in R^n",
    summary: "Learn about vector spaces.",
    orderIndex: 1,
    status: "completed",
    contentJson: '{"title":"Vectors","summary":"s","learningObjectives":[],"sections":[],"workedExamples":[],"practiceExercises":[],"keyTakeaways":[]}',
    rawMarkdown: "# Vectors\n\nSome markdown.",
    isSupplementary: false,
    weight: 1.0,
    completedAt: LATER,
    createdAt: NOW,
    updatedAt: LATER,
    generationPrompt: "Generate a lesson about vectors.",
    quizzes: [],
    notes: [],
    chatMessages: [],
    ...overrides,
  } as unknown as FullCourseData["lessons"][number];
}

function makeEdge(
  overrides: Partial<FullCourseData["edges"][number]> = {}
): FullCourseData["edges"][number] {
  return {
    id: "edge-1",
    courseId: "course-1",
    fromLessonId: "lesson-1",
    toLessonId: "lesson-2",
    relationship: "prerequisite",
    ...overrides,
  } as unknown as FullCourseData["edges"][number];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("toExportJson", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("strips internal IDs and includes version field", () => {
    const data = baseCourse({
      lessons: [makeLesson()],
    });

    const result = toExportJson(data);

    // Has version field
    expect(result.version).toBe(1);

    // Has exportedAt timestamp
    expect(result.exportedAt).toBe("2026-02-01T00:00:00.000Z");

    // Course object should NOT contain internal IDs
    expect(result.course).not.toHaveProperty("id");
    expect(result.course).not.toHaveProperty("userId");
    expect(result.course).not.toHaveProperty("createdAt");
    expect(result.course).not.toHaveProperty("updatedAt");
    expect(result.course).not.toHaveProperty("clonedFromId");

    // Lesson objects should NOT contain internal IDs
    expect(result.lessons[0]).not.toHaveProperty("id");
    expect(result.lessons[0]).not.toHaveProperty("courseId");
    expect(result.lessons[0]).not.toHaveProperty("createdAt");
    expect(result.lessons[0]).not.toHaveProperty("updatedAt");
    expect(result.lessons[0]).not.toHaveProperty("generationPrompt");

    // Course metadata is preserved
    expect(result.course.title).toBe("Linear Algebra Fundamentals");
    expect(result.course.topic).toBe("Linear Algebra");
    expect(result.course.difficulty).toBe("intermediate");
  });

  it("uses fromLessonIndex/toLessonIndex instead of lesson IDs for edges", () => {
    const lesson1 = makeLesson({ id: "lesson-aaa", orderIndex: 0 });
    const lesson2 = makeLesson({ id: "lesson-bbb", title: "Matrices", orderIndex: 1 });
    const lesson3 = makeLesson({ id: "lesson-ccc", title: "Determinants", orderIndex: 2 });

    const data = baseCourse({
      lessons: [lesson1, lesson2, lesson3],
      edges: [
        makeEdge({
          fromLessonId: "lesson-aaa",
          toLessonId: "lesson-bbb",
          relationship: "prerequisite",
        }),
        makeEdge({
          id: "edge-2",
          fromLessonId: "lesson-bbb",
          toLessonId: "lesson-ccc",
          relationship: "recommended",
        }),
      ],
    });

    const result = toExportJson(data);

    // Edges use index-based references, not IDs
    expect(result.edges).toHaveLength(2);

    expect(result.edges[0]).toEqual({
      fromLessonIndex: 0,
      toLessonIndex: 1,
      relationship: "prerequisite",
    });

    expect(result.edges[1]).toEqual({
      fromLessonIndex: 1,
      toLessonIndex: 2,
      relationship: "recommended",
    });

    // Edges should NOT contain internal IDs
    expect(result.edges[0]).not.toHaveProperty("id");
    expect(result.edges[0]).not.toHaveProperty("courseId");
    expect(result.edges[0]).not.toHaveProperty("fromLessonId");
    expect(result.edges[0]).not.toHaveProperty("toLessonId");
  });

  it("serializes Date fields as ISO strings", () => {
    const data = baseCourse({
      lessons: [
        makeLesson({
          completedAt: new Date("2026-01-20T14:30:00.000Z") as unknown as FullCourseData["lessons"][number]["completedAt"],
          quizzes: [
            {
              id: "quiz-1",
              lessonId: "lesson-1",
              questionsJson: "[]",
              questionCount: 5,
              status: "completed",
              generation: 1,
              isActive: true,
              createdAt: NOW,
              attempts: [
                {
                  id: "attempt-1",
                  quizId: "quiz-1",
                  answersJson: "{}",
                  score: 0.9,
                  weakTopics: "[]",
                  recommendation: "advance",
                  createdAt: new Date("2026-01-18T10:00:00.000Z"),
                },
              ],
            },
          ] as unknown as FullCourseData["lessons"][number]["quizzes"],
          chatMessages: [
            {
              id: "msg-1",
              lessonId: "lesson-1",
              role: "user",
              content: "What is a vector?",
              createdAt: new Date("2026-01-17T09:00:00.000Z"),
            },
          ] as unknown as FullCourseData["lessons"][number]["chatMessages"],
        }),
      ],
    });

    const result = toExportJson(data);

    // Lesson completedAt is an ISO string
    expect(result.lessons[0].completedAt).toBe("2026-01-20T14:30:00.000Z");
    expect(typeof result.lessons[0].completedAt).toBe("string");

    // Quiz attempt createdAt is an ISO string
    expect(result.lessons[0].quizzes[0].attempts[0].createdAt).toBe("2026-01-18T10:00:00.000Z");
    expect(typeof result.lessons[0].quizzes[0].attempts[0].createdAt).toBe("string");

    // Chat message createdAt is an ISO string
    expect(result.lessons[0].chatMessages[0].createdAt).toBe("2026-01-17T09:00:00.000Z");
    expect(typeof result.lessons[0].chatMessages[0].createdAt).toBe("string");
  });

  it("preserves all lesson data: quizzes, notes, and chatMessages", () => {
    const data = baseCourse({
      lessons: [
        makeLesson({
          quizzes: [
            {
              id: "quiz-1",
              lessonId: "lesson-1",
              questionsJson: '[{"question":"Q1"}]',
              questionCount: 1,
              status: "completed",
              generation: 2,
              isActive: true,
              createdAt: NOW,
              attempts: [
                {
                  id: "attempt-1",
                  quizId: "quiz-1",
                  answersJson: '{"q1":["a"]}',
                  score: 0.85,
                  weakTopics: '["topic1"]',
                  recommendation: "advance",
                  createdAt: NOW,
                },
              ],
            },
          ] as unknown as FullCourseData["lessons"][number]["quizzes"],
          notes: [
            {
              id: "note-1",
              lessonId: "lesson-1",
              courseId: null,
              title: "My Lesson Note",
              content: "Important observation.",
              isScratchpad: true,
              orderIndex: 0,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ] as unknown as FullCourseData["lessons"][number]["notes"],
          chatMessages: [
            {
              id: "msg-1",
              lessonId: "lesson-1",
              role: "user",
              content: "Explain vectors",
              createdAt: NOW,
            },
            {
              id: "msg-2",
              lessonId: "lesson-1",
              role: "assistant",
              content: "A vector is...",
              createdAt: LATER,
            },
          ] as unknown as FullCourseData["lessons"][number]["chatMessages"],
        }),
      ],
    });

    const result = toExportJson(data);
    const lesson = result.lessons[0];

    // Quizzes preserved
    expect(lesson.quizzes).toHaveLength(1);
    expect(lesson.quizzes[0].questionsJson).toBe('[{"question":"Q1"}]');
    expect(lesson.quizzes[0].questionCount).toBe(1);
    expect(lesson.quizzes[0].status).toBe("completed");
    expect(lesson.quizzes[0].generation).toBe(2);
    expect(lesson.quizzes[0].isActive).toBe(true);

    // Quiz attempts preserved
    expect(lesson.quizzes[0].attempts).toHaveLength(1);
    expect(lesson.quizzes[0].attempts[0].score).toBe(0.85);
    expect(lesson.quizzes[0].attempts[0].weakTopics).toBe('["topic1"]');
    expect(lesson.quizzes[0].attempts[0].recommendation).toBe("advance");

    // Notes preserved (without internal IDs)
    expect(lesson.notes).toHaveLength(1);
    expect(lesson.notes[0].title).toBe("My Lesson Note");
    expect(lesson.notes[0].content).toBe("Important observation.");
    expect(lesson.notes[0].isScratchpad).toBe(true);
    expect(lesson.notes[0].orderIndex).toBe(0);

    // Chat messages preserved (without internal IDs)
    expect(lesson.chatMessages).toHaveLength(2);
    expect(lesson.chatMessages[0].role).toBe("user");
    expect(lesson.chatMessages[0].content).toBe("Explain vectors");
    expect(lesson.chatMessages[1].role).toBe("assistant");
    expect(lesson.chatMessages[1].content).toBe("A vector is...");
  });

  it("handles diagnosticQuiz as null", () => {
    const data = baseCourse({ diagnosticQuiz: null });
    const result = toExportJson(data);

    expect(result.diagnosticQuiz).toBeNull();
  });

  it("handles diagnosticQuiz when present", () => {
    const data = baseCourse({
      diagnosticQuiz: {
        id: "diag-1",
        courseId: "course-1",
        questionsJson: '[{"question":"Diagnostic Q1"}]',
        status: "completed",
        createdAt: NOW,
        attempts: [
          {
            id: "dattempt-1",
            diagnosticQuizId: "diag-1",
            answersJson: '{"q1":["b"]}',
            score: 0.7,
            weakAreas: '["Algebra"]',
            recommendation: "Focus on algebra fundamentals.",
            suggestedCourseTitle: "Algebra Refresher",
            createdAt: LATER,
          },
        ],
      } as unknown as FullCourseData["diagnosticQuiz"],
    });

    const result = toExportJson(data);

    expect(result.diagnosticQuiz).not.toBeNull();
    expect(result.diagnosticQuiz!.questionsJson).toBe('[{"question":"Diagnostic Q1"}]');
    expect(result.diagnosticQuiz!.status).toBe("completed");

    // Attempts preserved
    expect(result.diagnosticQuiz!.attempts).toHaveLength(1);
    expect(result.diagnosticQuiz!.attempts[0].score).toBe(0.7);
    expect(result.diagnosticQuiz!.attempts[0].weakAreas).toBe('["Algebra"]');
    expect(result.diagnosticQuiz!.attempts[0].recommendation).toBe("Focus on algebra fundamentals.");
    expect(result.diagnosticQuiz!.attempts[0].suggestedCourseTitle).toBe("Algebra Refresher");
    expect(result.diagnosticQuiz!.attempts[0].createdAt).toBe("2026-01-16T08:30:00.000Z");

    // Internal IDs stripped
    expect(result.diagnosticQuiz).not.toHaveProperty("id");
    expect(result.diagnosticQuiz).not.toHaveProperty("courseId");
    expect(result.diagnosticQuiz).not.toHaveProperty("createdAt");
  });

  it("handles completionSummary as null", () => {
    const data = baseCourse({ completionSummary: null });
    const result = toExportJson(data);

    expect(result.completionSummary).toBeNull();
  });

  it("handles completionSummary when present", () => {
    const data = baseCourse({
      completionSummary: {
        id: "cs-1",
        courseId: "course-1",
        summaryJson: '{"overallScore":0.92}',
        narrativeMarkdown: "Great job completing the course!",
        recommendationJson: '["Study topology next"]',
        completedAt: LATER,
      } as unknown as FullCourseData["completionSummary"],
    });

    const result = toExportJson(data);

    expect(result.completionSummary).not.toBeNull();
    expect(result.completionSummary!.summaryJson).toBe('{"overallScore":0.92}');
    expect(result.completionSummary!.narrativeMarkdown).toBe("Great job completing the course!");
    expect(result.completionSummary!.recommendationJson).toBe('["Study topology next"]');
    expect(result.completionSummary!.completedAt).toBe("2026-01-16T08:30:00.000Z");
    expect(typeof result.completionSummary!.completedAt).toBe("string");

    // Internal IDs stripped
    expect(result.completionSummary).not.toHaveProperty("id");
    expect(result.completionSummary).not.toHaveProperty("courseId");
  });

  it("exports course-level notes without internal IDs", () => {
    const data = baseCourse({
      notes: [
        {
          id: "note-c1",
          lessonId: null,
          courseId: "course-1",
          title: "Course Note",
          content: "Overview of the course.",
          isScratchpad: false,
          orderIndex: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "note-c2",
          lessonId: null,
          courseId: "course-1",
          title: null,
          content: "A second note.",
          isScratchpad: true,
          orderIndex: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ] as unknown as FullCourseData["notes"],
    });

    const result = toExportJson(data);

    expect(result.courseNotes).toHaveLength(2);
    expect(result.courseNotes[0]).toEqual({
      title: "Course Note",
      content: "Overview of the course.",
      isScratchpad: false,
      orderIndex: 0,
    });
    expect(result.courseNotes[1]).toEqual({
      title: null,
      content: "A second note.",
      isScratchpad: true,
      orderIndex: 1,
    });

    // No internal IDs
    expect(result.courseNotes[0]).not.toHaveProperty("id");
    expect(result.courseNotes[0]).not.toHaveProperty("courseId");
    expect(result.courseNotes[0]).not.toHaveProperty("createdAt");
  });

  it("handles lesson with null completedAt", () => {
    const data = baseCourse({
      lessons: [
        makeLesson({
          completedAt: null as unknown as FullCourseData["lessons"][number]["completedAt"],
          status: "pending",
        }),
      ],
    });

    const result = toExportJson(data);
    expect(result.lessons[0].completedAt).toBeNull();
  });

  it("preserves all course-level fields", () => {
    const data = baseCourse({
      title: "Advanced Topology",
      description: "A deep dive into topological spaces.",
      topic: "Topology",
      focusAreas: JSON.stringify(["Homeomorphisms", "Compactness"]),
      targetLessonCount: 12,
      difficulty: "advanced",
      language: "pl",
      contextDoc: "Assumes knowledge of set theory.",
      passThreshold: 0.75,
      noLessonCanFail: false,
      lessonFailureThreshold: 0.4,
      status: "completed",
    });

    const result = toExportJson(data);

    expect(result.course).toEqual({
      title: "Advanced Topology",
      description: "A deep dive into topological spaces.",
      topic: "Topology",
      focusAreas: JSON.stringify(["Homeomorphisms", "Compactness"]),
      targetLessonCount: 12,
      difficulty: "advanced",
      language: "pl",
      contextDoc: "Assumes knowledge of set theory.",
      passThreshold: 0.75,
      noLessonCanFail: false,
      lessonFailureThreshold: 0.4,
      status: "completed",
    });
  });

  it("preserves lesson content and structural fields", () => {
    const contentJson = '{"title":"T","summary":"s","learningObjectives":[],"sections":[{"type":"text","content":"Hello"}],"workedExamples":[],"practiceExercises":[],"keyTakeaways":[]}';

    const data = baseCourse({
      lessons: [
        makeLesson({
          orderIndex: 3,
          title: "Eigenvalues",
          summary: "Learn about eigenvalues.",
          status: "completed",
          contentJson,
          rawMarkdown: "# Eigenvalues",
          isSupplementary: true,
          weight: 2.5,
        }),
      ],
    });

    const result = toExportJson(data);
    const lesson = result.lessons[0];

    expect(lesson.orderIndex).toBe(3);
    expect(lesson.title).toBe("Eigenvalues");
    expect(lesson.summary).toBe("Learn about eigenvalues.");
    expect(lesson.status).toBe("completed");
    expect(lesson.contentJson).toBe(contentJson);
    expect(lesson.rawMarkdown).toBe("# Eigenvalues");
    expect(lesson.isSupplementary).toBe(true);
    expect(lesson.weight).toBe(2.5);
  });
});
