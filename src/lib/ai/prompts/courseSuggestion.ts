import { buildLanguageInstruction } from "./languageInstruction";

interface CourseInfo {
  title: string;
  topic: string;
  subjects: string[];
  description: string;
  focusAreas: string[];
  difficulty: string;
  completionPercent: number;
}

export function buildCourseSuggestionPrompt(params: {
  courses: CourseInfo[];
  language: string;
}) {
  const courseList = params.courses
    .map((c, i) => {
      const parts = [
        `${i + 1}. "${c.title}"`,
        `   Topic: ${c.topic}`,
        `   Subjects: ${c.subjects.join(", ") || "unspecified"}`,
        `   Description: ${c.description}`,
      ];
      if (c.focusAreas.length > 0) {
        parts.push(`   Focus areas: ${c.focusAreas.join(", ")}`);
      }
      parts.push(`   Difficulty: ${c.difficulty}`);
      parts.push(`   Completion: ${c.completionPercent}%`);
      return parts.join("\n");
    })
    .join("\n\n");

  let prompt = `You are an expert educational course designer. Analyze the user's learning portfolio below and propose 3 creative interdisciplinary courses that blend their interests in novel ways.

USER'S COURSE LIBRARY:
${courseList}

REQUIREMENTS:
1. Propose exactly 3 course suggestions.
2. Each suggestion should draw connections between 2 or more of the user's existing courses.
3. Find NON-OBVIOUS connections — don't just combine two topics superficially. Look for deeper mathematical, conceptual, or methodological links.
4. For each suggestion, explain in the rationale WHY this particular user would find it compelling given their specific learning history.
5. Vary difficulty levels across the 3 suggestions (at least 2 different levels).
6. The "connectedCourses" field must contain exact titles from the user's library that this suggestion draws from.
7. Suggest 3-5 specific focus areas for each course.
8. Estimate a realistic lesson count (5-20) based on the topic scope.
9. Make titles creative and specific — not generic textbook names.
10. Descriptions should be 2-3 sentences that convey the unique angle of the course.`;

  prompt += buildLanguageInstruction(params.language);

  return prompt;
}
