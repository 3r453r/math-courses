import { describe, it, expect } from "vitest";
import { toMarkdown } from "./toMarkdown";
import type { FullCourseData } from "./courseData";

// ---------------------------------------------------------------------------
// Helpers to build mock FullCourseData matching the Prisma return shape
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-15T12:00:00.000Z");

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
    contextDoc: null,
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
    contentJson: null,
    rawMarkdown: null,
    isSupplementary: false,
    weight: 1.0,
    completedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    generationPrompt: null,
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

function makeNote(
  overrides: Partial<FullCourseData["notes"][number]> = {}
): FullCourseData["notes"][number] {
  return {
    id: "note-1",
    lessonId: null,
    courseId: "course-1",
    title: "My Note",
    content: "Some note content.",
    isScratchpad: false,
    orderIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as unknown as FullCourseData["notes"][number];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("toMarkdown", () => {
  it("renders basic course with one text-only lesson", () => {
    const contentJson = JSON.stringify({
      title: "Vectors in R^n",
      summary: "Learn about vector spaces.",
      learningObjectives: ["Understand vectors"],
      sections: [{ type: "text", content: "A vector is an element of a vector space." }],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: ["Vectors are fundamental."],
    });

    const data = baseCourse({
      lessons: [makeLesson({ contentJson })],
    });

    const md = toMarkdown(data);

    // Course header
    expect(md).toContain("# Linear Algebra Fundamentals");
    expect(md).toContain("An introduction to vectors and matrices.");

    // Metadata
    expect(md).toContain("**Topic:** Linear Algebra");
    expect(md).toContain("**Difficulty:** intermediate");
    expect(md).toContain("**Lessons:** 1");
    expect(md).toContain("**Focus Areas:** Vectors, Matrices");

    // Lesson header
    expect(md).toContain("## 1. Vectors in R^n");
    expect(md).toContain("> Learn about vector spaces.");

    // Learning objectives
    expect(md).toContain("### Learning Objectives");
    expect(md).toContain("- Understand vectors");

    // Text section content
    expect(md).toContain("A vector is an element of a vector space.");

    // Key takeaways
    expect(md).toContain("### Key Takeaways");
    expect(md).toContain("- Vectors are fundamental.");
  });

  it("passes through $...$ and $$...$$ LaTeX verbatim in math sections", () => {
    const contentJson = JSON.stringify({
      title: "Math Section",
      summary: "s",
      learningObjectives: [],
      sections: [
        {
          type: "text",
          content: "Inline math: $x^2 + y^2 = r^2$ in text.",
        },
        {
          type: "math",
          latex: "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
          explanation: "A basic integral.",
        },
      ],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({
      lessons: [makeLesson({ contentJson })],
    });

    const md = toMarkdown(data);

    // Inline LaTeX in text section passes through verbatim
    expect(md).toContain("$x^2 + y^2 = r^2$");

    // Math section renders as display math
    expect(md).toContain("$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$");
    expect(md).toContain("A basic integral.");
  });

  it("renders definitions with bold labels", () => {
    const contentJson = JSON.stringify({
      title: "Definitions",
      summary: "s",
      learningObjectives: [],
      sections: [
        {
          type: "definition",
          term: "Vector Space",
          definition: "A set V equipped with addition and scalar multiplication.",
          intuition: "Think of it as a collection of arrows.",
        },
      ],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({
      lessons: [makeLesson({ contentJson })],
    });

    const md = toMarkdown(data);

    expect(md).toContain("**Definition: Vector Space**");
    expect(md).toContain("A set V equipped with addition and scalar multiplication.");
    expect(md).toContain("*Intuition:* Think of it as a collection of arrows.");
  });

  it("renders theorems with bold labels", () => {
    const contentJson = JSON.stringify({
      title: "Theorems",
      summary: "s",
      learningObjectives: [],
      sections: [
        {
          type: "theorem",
          name: "Pythagorean Theorem",
          statement: "In a right triangle, $a^2 + b^2 = c^2$.",
          proof: "Consider a square with side $a + b$...",
          intuition: "The square on the hypotenuse equals the sum of the other two.",
        },
      ],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({
      lessons: [makeLesson({ contentJson })],
    });

    const md = toMarkdown(data);

    expect(md).toContain("**Theorem: Pythagorean Theorem**");
    expect(md).toContain("In a right triangle, $a^2 + b^2 = c^2$.");
    expect(md).toContain("*Proof:*");
    expect(md).toContain("Consider a square with side $a + b$...");
    expect(md).toContain("*Intuition:* The square on the hypotenuse equals the sum of the other two.");
  });

  it("renders visualizations with caption text and JSON code fence", () => {
    const spec = {
      xRange: [-5, 5] as [number, number],
      yRange: [-5, 5] as [number, number],
      functions: [{ expression: "sin(x)", color: "blue", label: "sin(x)" }],
    };

    const contentJson = JSON.stringify({
      title: "Visualization",
      summary: "s",
      learningObjectives: [],
      sections: [
        {
          type: "visualization",
          vizType: "function_plot",
          spec,
          caption: "Graph of sin(x)",
          interactionHint: "Drag to zoom",
        },
      ],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({
      lessons: [makeLesson({ contentJson })],
    });

    const md = toMarkdown(data);

    expect(md).toContain("**[Visualization: Graph of sin(x)]**");
    expect(md).toContain("*Type: function_plot*");
    expect(md).toContain("*Drag to zoom*");
    expect(md).toContain("```json");
    // The JSON spec is pretty-printed inside the code fence
    expect(md).toContain('"expression": "sin(x)"');
  });

  it("renders prerequisite edges as arrow text", () => {
    const lesson1 = makeLesson({ id: "lesson-1", title: "Intro", orderIndex: 1 });
    const lesson2 = makeLesson({ id: "lesson-2", title: "Advanced", orderIndex: 2 });

    const data = baseCourse({
      lessons: [lesson1, lesson2],
      edges: [
        makeEdge({
          fromLessonId: "lesson-1",
          toLessonId: "lesson-2",
          relationship: "prerequisite",
        }),
      ],
    });

    const md = toMarkdown(data);

    expect(md).toContain("## Prerequisite Structure");
    // Prerequisite edges have no parenthetical relationship tag
    expect(md).toContain("- Intro \u2192 Advanced");
    // Ensure no extra relationship text for "prerequisite" type
    expect(md).not.toContain("(prerequisite)");
  });

  it("renders non-prerequisite edge relationships with parenthetical tag", () => {
    const lesson1 = makeLesson({ id: "lesson-1", title: "Intro", orderIndex: 1 });
    const lesson2 = makeLesson({ id: "lesson-2", title: "Sidebar", orderIndex: 2 });

    const data = baseCourse({
      lessons: [lesson1, lesson2],
      edges: [
        makeEdge({
          fromLessonId: "lesson-1",
          toLessonId: "lesson-2",
          relationship: "recommended",
        }),
      ],
    });

    const md = toMarkdown(data);
    expect(md).toContain("- Intro \u2192 Sidebar (recommended)");
  });

  it("renders course-level notes", () => {
    const data = baseCourse({
      notes: [
        makeNote({ title: "Course Overview Note", content: "This course covers linear algebra." }),
        makeNote({ title: null, content: "A titleless note." }),
      ],
    });

    const md = toMarkdown(data);

    expect(md).toContain("## Course Notes");
    expect(md).toContain("**Course Overview Note**");
    expect(md).toContain("This course covers linear algebra.");
    expect(md).toContain("A titleless note.");
  });

  it("produces valid markdown for an empty course (no lessons)", () => {
    const data = baseCourse({ lessons: [], edges: [], notes: [] });

    const md = toMarkdown(data);

    // Should still have the header and metadata
    expect(md).toContain("# Linear Algebra Fundamentals");
    expect(md).toContain("## Course Info");
    expect(md).toContain("**Lessons:** 0");

    // Should NOT contain lesson or edge sections
    expect(md).not.toContain("## Prerequisite Structure");
    // Result should be a non-empty string
    expect(md.length).toBeGreaterThan(0);
  });

  it("renders lesson-level notes", () => {
    const lessonNote = {
      id: "note-ln-1",
      lessonId: "lesson-1",
      courseId: null,
      title: "Lesson Note Title",
      content: "Important observation about vectors.",
      isScratchpad: false,
      orderIndex: 0,
      createdAt: NOW,
      updatedAt: NOW,
    };

    const lesson = makeLesson({
      notes: [lessonNote] as unknown as FullCourseData["lessons"][number]["notes"],
    });

    const data = baseCourse({ lessons: [lesson] });
    const md = toMarkdown(data);

    expect(md).toContain("### Notes");
    expect(md).toContain("**Lesson Note Title**");
    expect(md).toContain("Important observation about vectors.");
  });

  it("renders context document when present", () => {
    const data = baseCourse({
      contextDoc: "This course assumes knowledge of basic arithmetic.",
    });

    const md = toMarkdown(data);

    expect(md).toContain("## Context Document");
    expect(md).toContain("This course assumes knowledge of basic arithmetic.");
  });

  it("renders completion summary when present", () => {
    const data = baseCourse({
      completionSummary: {
        id: "cs-1",
        courseId: "course-1",
        summaryJson: "{}",
        narrativeMarkdown: "You have successfully completed the course!",
        recommendationJson: null,
        completedAt: NOW,
      } as unknown as FullCourseData["completionSummary"],
    });

    const md = toMarkdown(data);

    expect(md).toContain("## Completion Summary");
    expect(md).toContain("You have successfully completed the course!");
  });

  it("renders active quiz questions with options and answers", () => {
    const questionsJson = JSON.stringify([
      {
        question: "What is a vector?",
        options: ["An arrow", "A number", "A matrix"],
        correctAnswer: "An arrow",
        explanation: "A vector can be visualized as an arrow.",
      },
    ]);

    const lesson = makeLesson({
      quizzes: [
        {
          id: "quiz-1",
          lessonId: "lesson-1",
          questionsJson,
          questionCount: 1,
          status: "completed",
          generation: 1,
          isActive: true,
          createdAt: NOW,
          attempts: [],
        },
      ] as unknown as FullCourseData["lessons"][number]["quizzes"],
    });

    const data = baseCourse({ lessons: [lesson] });
    const md = toMarkdown(data);

    expect(md).toContain("### Quiz");
    expect(md).toContain("**Q1:** What is a vector?");
    expect(md).toContain("- An arrow");
    expect(md).toContain("- A number");
    expect(md).toContain("- A matrix");
    expect(md).toContain("**Answer:** An arrow");
    expect(md).toContain("A vector can be visualized as an arrow.");
  });

  it("renders worked examples with steps and math", () => {
    const contentJson = JSON.stringify({
      title: "Worked Examples Test",
      summary: "s",
      learningObjectives: [],
      sections: [],
      workedExamples: [
        {
          title: "Find the magnitude",
          problemStatement: "Find $|\\vec{v}|$ where $\\vec{v} = (3, 4)$.",
          steps: [
            { description: "Apply the formula", math: "|\\vec{v}| = \\sqrt{3^2 + 4^2}" },
            { description: "Compute", math: "= \\sqrt{25} = 5" },
          ],
          finalAnswer: "$|\\vec{v}| = 5$",
        },
      ],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({ lessons: [makeLesson({ contentJson })] });
    const md = toMarkdown(data);

    expect(md).toContain("### Worked Examples");
    expect(md).toContain("#### Find the magnitude");
    expect(md).toContain("**Problem:** Find $|\\vec{v}|$ where $\\vec{v} = (3, 4)$.");
    expect(md).toContain("**Step 1:** Apply the formula");
    expect(md).toContain("$$|\\vec{v}| = \\sqrt{3^2 + 4^2}$$");
    expect(md).toContain("**Step 2:** Compute");
    expect(md).toContain("**Answer:** $|\\vec{v}| = 5$");
  });

  it("renders practice exercises with hints and solutions", () => {
    const contentJson = JSON.stringify({
      title: "Practice",
      summary: "s",
      learningObjectives: [],
      sections: [],
      workedExamples: [],
      practiceExercises: [
        {
          id: "ex1",
          problemStatement: "Compute the dot product of $(1,2)$ and $(3,4)$.",
          hints: ["Use the formula $a \\cdot b = a_1 b_1 + a_2 b_2$."],
          solution: "$1 \\cdot 3 + 2 \\cdot 4 = 11$",
          answerType: "free_response",
          expectedAnswer: "11",
        },
      ],
      keyTakeaways: [],
    });

    const data = baseCourse({ lessons: [makeLesson({ contentJson })] });
    const md = toMarkdown(data);

    expect(md).toContain("### Practice Exercises");
    expect(md).toContain("**Exercise 1:** Compute the dot product");
    expect(md).toContain("<details><summary>Hints</summary>");
    expect(md).toContain("Use the formula $a \\cdot b = a_1 b_1 + a_2 b_2$.");
    expect(md).toContain("<details><summary>Solution</summary>");
    expect(md).toContain("$1 \\cdot 3 + 2 \\cdot 4 = 11$");
    expect(md).toContain("**Answer:** 11");
  });

  it("renders code_block sections with language and explanation", () => {
    const contentJson = JSON.stringify({
      title: "Code",
      summary: "s",
      learningObjectives: [],
      sections: [
        {
          type: "code_block",
          language: "python",
          code: "import numpy as np\nv = np.array([1, 2, 3])",
          explanation: "Create a NumPy vector.",
        },
      ],
      workedExamples: [],
      practiceExercises: [],
      keyTakeaways: [],
    });

    const data = baseCourse({ lessons: [makeLesson({ contentJson })] });
    const md = toMarkdown(data);

    expect(md).toContain("```python");
    expect(md).toContain("import numpy as np");
    expect(md).toContain("v = np.array([1, 2, 3])");
    expect(md).toContain("Create a NumPy vector.");
  });

  it("marks supplementary lessons", () => {
    const lesson = makeLesson({ isSupplementary: true });
    const data = baseCourse({ lessons: [lesson] });
    const md = toMarkdown(data);

    expect(md).toContain("*Supplementary lesson*");
  });
});
