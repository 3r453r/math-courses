import { buildLanguageInstruction, LANGUAGE_NAMES } from "./languageInstruction";

const PRESERVE_RULES = `
CRITICAL PRESERVATION RULES — Do NOT translate any of the following:
- LaTeX math expressions ($...$ inline and $$...$$ display blocks) — keep verbatim
- Visualization "spec" field values (JSON objects with math expressions, function definitions)
- code_block "code" and "language" fields — keep programming code exactly as-is
- Practice exercise IDs (e.g. "ex1", "ex2"), quiz question IDs ("q1", "q2"), choice IDs ("a", "b", "c")
- Variable names, function identifiers, and mathematical notation
- vizType enum values ("function_plot", "vector_field", etc.)
- answerType enum values ("free_response", "multiple_choice", "numeric")
- difficulty enum values ("easy", "medium", "hard")
- Section type enum values ("text", "math", "definition", "theorem", "visualization", "code_block")

TRANSLATE the following:
- Titles, summaries, descriptions, explanations
- Learning objectives, key takeaways
- Worked example problem statements, step descriptions, final answers (text parts only)
- Practice exercise problem statements, hints, solutions (text parts only)
- Quiz question text, choice text, choice explanations
- Section content (text, definitions, theorems, proofs, intuitions, captions, interaction hints)
- Term names in definitions
- Theorem names

Preserve the exact JSON structure and all field names. Output must conform to the same schema as the input.`;

export function buildCourseTranslationPrompt(
  source: { title: string; description: string; contextDoc: string | null },
  targetLanguage: string,
): string {
  const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
  return `You are a professional translator specializing in educational and mathematical content.

Translate the following course metadata from its current language into ${langName}.

SOURCE CONTENT:
Title: ${source.title}
Description: ${source.description}
${source.contextDoc ? `Context Document:\n${source.contextDoc}` : ""}

RULES:
- Translate all natural language text into ${langName}
- Preserve LaTeX notation verbatim
- Use standard ${langName} mathematical terminology
- Keep the pedagogical tone and style of the original
- The context document contains notation conventions and teaching guidelines — translate the prose but keep all mathematical symbols and LaTeX as-is
${buildLanguageInstruction(targetLanguage)}`;
}

export function buildLessonTranslationPrompt(
  sourceContentJson: string,
  targetLanguage: string,
): string {
  const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
  return `You are a professional translator specializing in educational and mathematical content.

Translate the following lesson content from its current language into ${langName}. The content is structured educational material with text, math, definitions, theorems, visualizations, worked examples, and practice exercises.
${PRESERVE_RULES}
${buildLanguageInstruction(targetLanguage)}

SOURCE LESSON CONTENT (JSON):
${sourceContentJson}

Return the translated content maintaining the exact same JSON structure.`;
}

export function buildQuizTranslationPrompt(
  sourceQuestionsJson: string,
  lessonTitle: string,
  targetLanguage: string,
): string {
  const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
  return `You are a professional translator specializing in educational and mathematical content.

Translate the following quiz questions for the lesson "${lessonTitle}" from their current language into ${langName}.
${PRESERVE_RULES}
${buildLanguageInstruction(targetLanguage)}

SOURCE QUIZ CONTENT (JSON):
${sourceQuestionsJson}

Return the translated quiz maintaining the exact same JSON structure. Preserve all question IDs, choice IDs, correct/incorrect flags, difficulty levels, and topic strings (translate topic strings).`;
}
