import type { CourseStructureOutput } from "@/lib/ai/schemas/courseSchema";

export function mockCourseStructure(): CourseStructureOutput {
  return {
    title: "Mock Test Course",
    description: "This is a mock course generated for testing purposes. No API call was made.",
    subjects: ["Mathematics"],
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
        weight: 1.0,
      },
      {
        title: "Mock Lesson 2: Core Concepts",
        summary: "Builds on the introduction with deeper mock concepts.",
        orderIndex: 1,
        prerequisites: [0],
        keyTopics: ["arithmetic", "fundamentals"],
        estimatedDifficulty: "foundational",
        weight: 1.5,
      },
      {
        title: "Mock Lesson 3: Advanced Topics",
        summary: "Advanced mock content that depends on core concepts.",
        orderIndex: 2,
        prerequisites: [1],
        keyTopics: ["algebra", "problem solving"],
        estimatedDifficulty: "intermediate",
        weight: 2.0,
      },
    ],
    edges: [
      {
        from: 0,
        to: 1,
        relationship: "prerequisite" as const,
      },
      {
        from: 1,
        to: 2,
        relationship: "prerequisite" as const,
      },
    ],
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

export function mockCompletionSummary() {
  return {
    narrative:
      "## Course Completion Summary\n\n" +
      "Congratulations on completing this course! You demonstrated strong understanding across all core topics. " +
      "Your performance on **Mock Lesson 1: Introduction** was excellent, showing solid grasp of foundational concepts. " +
      "In **Mock Lesson 2: Core Concepts**, you showed good progress with arithmetic fundamentals, " +
      "though there is room to deepen your understanding of number relationships.\n\n" +
      "**Mock Lesson 3: Advanced Topics** challenged you the most, which is expected given the higher difficulty level. " +
      "Your persistence in working through the material paid off.\n\n" +
      "Overall, your weighted score reflects consistent effort and meaningful learning. " +
      "Keep building on these foundations as you move to more advanced topics.",
    recommendation: {
      type: "broader" as const,
      suggestedTopic: "Applied Mathematics Fundamentals",
      suggestedDescription:
        "Explore how mathematical concepts connect to real-world applications. " +
        "This course builds on your foundational knowledge and introduces practical problem-solving techniques.",
      suggestedDifficulty: "intermediate" as const,
      suggestedFocusAreas: [
        "Problem modeling",
        "Estimation techniques",
        "Data interpretation",
        "Mathematical reasoning",
      ],
      rationale:
        "Based on your strong foundational performance, broadening into applied topics " +
        "will reinforce your understanding while introducing practical skills.",
    },
  };
}

export function mockTrivia() {
  const titles = [
    "The Bridge Problem That Started Graph Theory",
    "Why $e$ Shows Up Everywhere",
    "Gauss Was 10 When He Outsmarted His Teacher",
    "The Barber Paradox",
    "Infinity Comes in Sizes",
    "A Proof So Beautiful It Made Mathematicians Cry",
    "The Four Color Theorem Needed a Computer",
    "Euler's Identity: The Most Beautiful Equation",
    "$\\pi$ Is Hiding in Your GPS",
    "Fibonacci in Sunflowers",
    "The Birthday Paradox Isn't Really a Paradox",
    "Ramanujan's Taxi Number 1729",
    "Banach-Tarski: Doubling a Sphere",
    "Benford's Law Catches Tax Fraud",
    "The Monty Hall Problem Stumped PhDs",
    "Imaginary Numbers Are Real Useful",
    "Why 0.999... = 1 (Really!)",
    "The Collatz Conjecture: Simple Yet Unsolved",
    "Fractals in Your Lungs",
    "The Unreasonable Effectiveness of Math",
  ];
  const facts = [
    "In 1736, Euler solved the famous Königsberg Bridge problem by proving it was impossible to walk across all seven bridges exactly once. This single puzzle launched an entire branch of mathematics — graph theory — which now underpins everything from social networks to GPS routing.",
    "The number $e \\approx 2.718$ appears in compound interest, radioactive decay, population growth, and even the shape of a hanging chain. It's nature's favorite base for exponential processes.",
    "Young Carl Friedrich Gauss was asked to sum the integers from 1 to 100 as busy work. He instantly realized the sum was $50 \\times 101 = 5050$ by pairing numbers from opposite ends. His teacher was stunned.",
    "\"Does the barber who shaves everyone who doesn't shave themselves shave himself?\" This paradox, posed by Bertrand Russell, shook the foundations of set theory and led to a complete overhaul of mathematical logic.",
    "Georg Cantor proved that the infinity of real numbers is strictly larger than the infinity of natural numbers. His diagonal argument is one of the most elegant proofs in all of mathematics.",
    "When Paul Erdős first saw an elegant proof, he'd say it came from \"The Book\" — God's collection of perfect proofs. This inspired the actual book *Proofs from THE BOOK*, compiling the most beautiful arguments in math.",
    "In 1976, the Four Color Theorem became the first major theorem proved with computer assistance. Many mathematicians initially refused to accept it because no human could verify all the cases by hand.",
    "Euler's identity $e^{i\\pi} + 1 = 0$ connects five fundamental constants in one equation. Richard Feynman called it \"the most remarkable formula in mathematics.\"",
    "$\\pi$ isn't just about circles. It appears in the Fourier transforms used by GPS satellites to calculate your position, in quantum mechanics, and even in the distribution of prime numbers.",
    "The Fibonacci sequence $(1, 1, 2, 3, 5, 8, \\ldots)$ appears in sunflower seed spirals, pinecone scales, and galaxy arms. The ratio of consecutive terms converges to the golden ratio $\\phi \\approx 1.618$.",
    "In a room of just 23 people, there's a 50% chance two share a birthday. With 70 people, it's 99.9%. This counter-intuitive result trips up even statisticians because we underestimate the number of possible pairs.",
    "When Hardy visited Ramanujan in hospital and mentioned his taxi was number 1729, a 'dull number', Ramanujan instantly replied: 'No! It's the smallest number expressible as the sum of two cubes in two different ways: $1729 = 1^3 + 12^3 = 9^3 + 10^3$.'",
    "The Banach-Tarski paradox proves you can decompose a solid ball into five pieces and reassemble them into TWO balls, each identical to the original. It's mathematically rigorous but physically impossible.",
    "Benford's Law says that in many real-world datasets, the leading digit is 1 about 30% of the time. Forensic accountants use this to detect fraudulent financial records, since faked numbers don't follow the pattern.",
    "When Marilyn vos Savant published the correct solution to the Monty Hall problem in 1990, she received 10,000 letters — many from PhD mathematicians — telling her she was wrong. She wasn't.",
    "Imaginary numbers ($i = \\sqrt{-1}$) were dismissed as 'useless' for centuries. Today they're essential in electrical engineering, quantum physics, and signal processing. Every phone call you make relies on complex number arithmetic.",
    "It's not a rounding trick: $0.999\\ldots = 1$ exactly. One proof: let $x = 0.999\\ldots$. Then $10x = 9.999\\ldots$, so $10x - x = 9$, meaning $9x = 9$ and $x = 1$. QED.",
    "Take any positive integer. If even, halve it; if odd, triple it and add 1. Repeat. The Collatz conjecture says you always reach 1. It's been verified up to $10^{20}$ but nobody can prove it. Erdős said 'Mathematics is not yet ready for such problems.'",
    "Your lungs have a fractal-like branching structure that packs about 70 $m^2$ of surface area into your chest. Evolution discovered fractals long before Mandelbrot named them.",
    "In 1960, physicist Eugene Wigner wrote about 'the unreasonable effectiveness of mathematics in the natural sciences.' Why should abstract equations invented by humans perfectly describe the universe? Nobody knows.",
  ];
  const ratings: ("mind-blowing" | "cool" | "neat")[] = [
    "cool", "neat", "cool", "mind-blowing", "mind-blowing",
    "neat", "cool", "mind-blowing", "cool", "neat",
    "mind-blowing", "cool", "mind-blowing", "cool", "mind-blowing",
    "cool", "mind-blowing", "neat", "cool", "mind-blowing",
  ];

  return {
    slides: titles.map((title, i) => ({
      title,
      fact: facts[i],
      funRating: ratings[i],
    })),
  };
}

export function mockCourseSuggestions() {
  return {
    suggestions: [
      {
        title: "The Geometry of Machine Learning: From Vectors to Neural Manifolds",
        description:
          "Explore how geometric intuition from linear algebra illuminates the hidden structure of neural networks. " +
          "You'll learn to visualize high-dimensional optimization landscapes and understand why deep learning works through the lens of differential geometry.",
        topic: "Geometric Deep Learning",
        rationale:
          "Your background in Linear Algebra and Machine Learning gives you the perfect foundation to explore this cutting-edge intersection. " +
          "Understanding vector spaces and transformations will help you see neural networks as geometric objects rather than black boxes.",
        connectedCourses: ["Mock Test Course"],
        focusAreas: [
          "Manifold learning",
          "Optimization geometry",
          "Representation theory",
          "Graph neural networks",
        ],
        difficulty: "advanced" as const,
        estimatedLessons: 12,
      },
      {
        title: "Numbers That Changed History: Mathematics as a Force of Civilization",
        description:
          "Trace how mathematical discoveries — from zero to calculus to cryptography — reshaped economies, won wars, and enabled technologies we take for granted. " +
          "Each lesson connects a mathematical idea to its world-changing consequences.",
        topic: "History of Mathematics and Its Impact",
        rationale:
          "Your existing courses show strong technical foundations. This course offers a broader perspective, " +
          "connecting the abstract concepts you've studied to their real-world historical impact and helping you see the bigger picture.",
        connectedCourses: ["Mock Test Course"],
        focusAreas: [
          "Ancient number systems",
          "The calculus priority dispute",
          "Cryptography in wartime",
          "The birth of computing",
          "Modern mathematical frontiers",
        ],
        difficulty: "beginner" as const,
        estimatedLessons: 10,
      },
      {
        title: "Problem Solving Toolkit: Strategies That Work Across Disciplines",
        description:
          "Master a versatile set of problem-solving strategies — from proof techniques and estimation to modeling and dimensional analysis. " +
          "Each strategy is practiced across multiple domains so you build transferable thinking skills.",
        topic: "Cross-Disciplinary Problem Solving",
        rationale:
          "Across your courses, you've encountered problems from different angles. This course unifies those approaches " +
          "into a coherent toolkit, making you a more versatile and creative problem solver.",
        connectedCourses: ["Mock Test Course"],
        focusAreas: [
          "Proof strategies",
          "Fermi estimation",
          "Mathematical modeling",
          "Dimensional analysis",
        ],
        difficulty: "intermediate" as const,
        estimatedLessons: 8,
      },
    ],
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
