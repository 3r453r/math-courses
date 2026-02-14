import type { CourseStructureOutput } from "@/lib/ai/schemas/courseSchema";

export function mockCourseStructure(): CourseStructureOutput {
  return {
    title: "Mock Test Course",
    description: "This is a mock course generated for testing purposes. No API call was made.",
    suggestedLessonCount: 3,
    contextDoc: "## Notation Conventions\n- Variables: lowercase italic ($x$, $y$)\n- Functions: standard notation ($f(x)$)\n\n## Pedagogical Approach\nIntuition before formalism. Start with concrete examples.\n\n## Key Themes\nTesting and mock data verification.\n\n## Difficulty Calibration\nIntroductory level, accessible to beginners.\n\n## Style Guidelines\nKeep explanations concise and use examples liberally.",
    lessons: [
      {
        title: "Mock Lesson 1: Introduction",
        summary: "A mock introductory lesson for testing the generation pipeline.",
        orderIndex: 0,
        prerequisites: [],
        keyTopics: ["testing", "mock data"],
        estimatedDifficulty: "introductory",
      },
    ],
    edges: [],
  };
}

export function mockLessonContent() {
  return {
    title: "Mock Lesson Content",
    summary: "Generated mock content for testing.",
    learningObjectives: [
      "Verify that lesson rendering works correctly",
      "Test the $\\LaTeX$ rendering pipeline",
    ],
    sections: [
      {
        type: "text" as const,
        content:
          "This is **mock generated content** for testing purposes. No API tokens were spent.\n\nHere is some inline math: $f(x) = x^2 + 1$ and display math:\n\n$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$",
      },
      {
        type: "definition" as const,
        term: "Mock Data",
        definition: "Data generated without an API call, used for testing and debugging the application pipeline.",
        intuition: "Think of it as a placeholder that lets you verify the UI works without spending money.",
      },
      {
        type: "math" as const,
        latex: "e^{i\\pi} + 1 = 0",
        explanation: "Euler's identity, included here as a test of the KaTeX rendering block.",
      },
      {
        type: "visualization" as const,
        vizType: "function_plot" as const,
        spec: {
          xRange: [-3, 3] as [number, number],
          yRange: [-1, 10] as [number, number],
          functions: [
            { expression: "Math.pow(x, 2)", color: "blue", label: "x^2" },
            { expression: "Math.pow(x, 2) + 1", color: "red", label: "x^2 + 1" },
          ],
        },
        caption: "A simple function plot for testing visualization rendering.",
        interactionHint: "Drag to pan, scroll to zoom.",
      },
    ],
    workedExamples: [
      {
        title: "Mock Worked Example",
        problemStatement: "Compute $2 + 2$.",
        steps: [
          { description: "We start with the expression $2 + 2$." },
          { description: "Adding the two numbers:", math: "2 + 2 = 4" },
        ],
        finalAnswer: "$4$",
      },
    ],
    practiceExercises: [
      {
        id: "mock-ex-1",
        problemStatement: "What is $3 \\times 3$?",
        hints: ["Multiply three by itself."],
        solution: "$3 \\times 3 = 9$",
        answerType: "numeric" as const,
        expectedAnswer: "9",
      },
    ],
    keyTakeaways: [
      "The mock mode works correctly!",
      "No API tokens were consumed.",
    ],
  };
}

export function mockQuiz() {
  const questions = Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    questionText: `**Mock Question ${i + 1}:** What is $${i + 1} + ${i + 1}$?`,
    choices: [
      {
        id: "a",
        text: `$${(i + 1) * 2}$`,
        correct: true,
        explanation: `Correct! $${i + 1} + ${i + 1} = ${(i + 1) * 2}$.`,
      },
      {
        id: "b",
        text: `$${(i + 1) * 2 + 1}$`,
        correct: false,
        explanation: `Incorrect. $${i + 1} + ${i + 1} = ${(i + 1) * 2}$, not $${(i + 1) * 2 + 1}$.`,
      },
      {
        id: "c",
        text: `$${(i + 1) * 2 - 1}$`,
        correct: false,
        explanation: `Incorrect. $${i + 1} + ${i + 1} = ${(i + 1) * 2}$, not $${(i + 1) * 2 - 1}$.`,
      },
      {
        id: "d",
        text: `$${(i + 1) * 3}$`,
        correct: false,
        explanation: `Incorrect. You may be thinking of $${i + 1} \\times 3 = ${(i + 1) * 3}$.`,
      },
    ],
    topic: i < 5 ? "Addition" : "Arithmetic",
    difficulty: (i < 3 ? "easy" : i < 7 ? "medium" : "hard") as "easy" | "medium" | "hard",
  }));

  return { questions };
}

export function mockLessonWithQuiz() {
  return {
    lesson: mockLessonContent(),
    quiz: mockQuiz(),
  };
}

export function mockDiagnostic() {
  return {
    prerequisites: [
      {
        topic: "Basic Arithmetic",
        importance: "essential" as const,
        description: "Ability to add, subtract, multiply, and divide integers.",
      },
      {
        topic: "Number Sense",
        importance: "helpful" as const,
        description: "Intuitive understanding of number relationships.",
      },
    ],
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `d${i + 1}`,
      questionText: `**Diagnostic ${i + 1}:** What is $${(i + 1) * 2} \\div 2$?`,
      choices: [
        {
          id: "a",
          text: `$${i + 1}$`,
          correct: true,
          explanation: `Correct! $${(i + 1) * 2} \\div 2 = ${i + 1}$.`,
        },
        {
          id: "b",
          text: `$${i + 2}$`,
          correct: false,
          explanation: `Incorrect. $${(i + 1) * 2} \\div 2 = ${i + 1}$.`,
        },
        {
          id: "c",
          text: `$${i}$`,
          correct: false,
          explanation: `Incorrect. $${(i + 1) * 2} \\div 2 = ${i + 1}$.`,
        },
        {
          id: "d",
          text: `$${(i + 1) * 2}$`,
          correct: false,
          explanation: `Incorrect. You need to divide by 2.`,
        },
      ],
      prerequisiteTopic: i < 5 ? "Basic Arithmetic" : "Number Sense",
      difficulty: (i < 3 ? "easy" : i < 7 ? "medium" : "hard") as "easy" | "medium" | "hard",
    })),
  };
}
