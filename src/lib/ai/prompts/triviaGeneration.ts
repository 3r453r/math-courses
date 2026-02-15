import { buildLanguageInstruction } from "./languageInstruction";

export function buildTriviaPrompt(params: {
  courseTopic: string;
  lessonTitle?: string;
  lessonSummary?: string;
  language?: string;
}) {
  let prompt = `You are a fun and engaging science communicator. Generate exactly 20 entertaining trivia items related to the topic below.

TOPIC: ${params.courseTopic}`;

  if (params.lessonTitle) {
    prompt += `\nLESSON: ${params.lessonTitle}`;
  }
  if (params.lessonSummary) {
    prompt += `\nLESSON SUMMARY: ${params.lessonSummary}`;
  }

  prompt += `

REQUIREMENTS:
1. Generate exactly 20 trivia slides.
2. Each slide should have a catchy short title and a 2-4 sentence fact.
3. Include a mix of:
   - Historical anecdotes (famous mathematicians/scientists, origin stories)
   - Surprising connections between fields
   - Counter-intuitive results or paradoxes
   - Real-world applications people wouldn't expect
   - Fun number facts or patterns
4. Use Markdown with LaTeX ($...$) for any math notation.
5. Rate each as "mind-blowing", "cool", or "neat" — aim for at least 5 mind-blowing ones.
6. Keep facts accurate and genuinely interesting — avoid well-known clichés.
7. Each title should be unique and attention-grabbing.`;

  prompt += buildLanguageInstruction(params.language ?? "en");

  return prompt;
}
