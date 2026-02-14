export function buildQuizPrompt(params: {
  lessonTitle: string;
  lessonSummary: string;
  courseTopic: string;
  difficulty: string;
  lessonContent?: unknown;
}) {
  let prompt = `You are an assessment designer for ${params.courseTopic}, creating a quiz for a specific lesson.

LESSON TITLE: ${params.lessonTitle}
LESSON SUMMARY: ${params.lessonSummary}
COURSE TOPIC: ${params.courseTopic}
DIFFICULTY LEVEL: ${params.difficulty}
`;

  if (params.lessonContent) {
    prompt += `\nLESSON CONTENT (generate questions that directly test this material):\n${JSON.stringify(params.lessonContent, null, 2)}\n`;
  }

  prompt += `
REQUIREMENTS:
1. Generate 10-20 multiple-choice questions testing the lesson content.
2. Each question should have 4-6 choices, with one or more correct answers.
3. Use Markdown with LaTeX ($...$ inline, $$...$$ display) for all math notation.
4. Vary difficulty across easy, medium, and hard questions.
5. Tag each question with a specific sub-topic from the lesson.
6. Provide a clear explanation for EVERY choice (why it's correct or incorrect).
7. Questions should test understanding, not memorization:
   - Include conceptual questions ("Which of the following is true about...")
   - Include computational questions ("Compute the value of...")
   - Include questions that require applying techniques to new situations
8. Ensure at least one question has multiple correct answers.
9. Each question ID should be unique (e.g., "q1", "q2", etc.).
10. Each choice ID should be unique within its question (e.g., "a", "b", "c", "d").`;

  return prompt;
}

export function buildDiagnosticPrompt(params: {
  courseTitle: string;
  courseTopic: string;
  courseDescription: string;
  difficulty: string;
  lessonTitles: string[];
}) {
  return `You are an assessment designer for ${params.courseTopic}, creating a diagnostic prerequisite quiz.

COURSE: ${params.courseTitle}
TOPIC: ${params.courseTopic}
DESCRIPTION: ${params.courseDescription}
DIFFICULTY: ${params.difficulty}
LESSON TITLES: ${params.lessonTitles.join(", ")}

YOUR TASK:
1. First, identify the prerequisite topics a student should know BEFORE starting this course.
   - Mark each as "essential", "helpful", or "optional"
   - Provide a brief description of why it's needed

2. Then generate 10-20 diagnostic questions that assess those prerequisites.
   - Each question tests ONE prerequisite topic (use the prerequisiteTopic field)
   - Use Markdown with LaTeX ($...$ inline, $$...$$ display) for math notation
   - 4-6 choices per question, one or more correct
   - Vary difficulty (easy/medium/hard)
   - Provide explanations for every choice
   - Questions should be diagnostic — designed to reveal gaps, not trick the student

3. Cover all essential prerequisites and most helpful ones.
4. Each question ID should be unique (e.g., "d1", "d2", etc.).
5. Each choice ID should be unique within its question (e.g., "a", "b", "c", "d").`;
}
