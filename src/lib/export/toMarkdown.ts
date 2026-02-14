import type { FullCourseData } from "./courseData";
import type { LessonContent, LessonSection } from "@/types/lesson";

/**
 * Convert full course data to a single Markdown string.
 * LaTeX passes through verbatim ($...$, $$...$$) — works in Obsidian, Typora, VS Code.
 * Visualizations are rendered as descriptive text + JSON spec code fence.
 */
export function toMarkdown(data: FullCourseData): string {
  const lines: string[] = [];

  // Course header
  lines.push(`# ${data.title}`);
  lines.push("");
  lines.push(data.description);
  lines.push("");

  // Metadata
  lines.push("## Course Info");
  lines.push("");
  lines.push(`- **Topic:** ${data.topic}`);
  lines.push(`- **Difficulty:** ${data.difficulty}`);
  lines.push(`- **Language:** ${data.language}`);
  const focusAreas = JSON.parse(data.focusAreas || "[]") as string[];
  if (focusAreas.length > 0) {
    lines.push(`- **Focus Areas:** ${focusAreas.join(", ")}`);
  }
  lines.push(`- **Lessons:** ${data.lessons.length}`);
  lines.push("");

  // Context document
  if (data.contextDoc) {
    lines.push("## Context Document");
    lines.push("");
    lines.push(data.contextDoc);
    lines.push("");
  }

  // DAG structure
  if (data.edges.length > 0) {
    lines.push("## Prerequisite Structure");
    lines.push("");
    const lessonIdToTitle = new Map<string, string>();
    for (const lesson of data.lessons) {
      lessonIdToTitle.set(lesson.id, lesson.title);
    }
    for (const edge of data.edges) {
      const from = lessonIdToTitle.get(edge.fromLessonId) ?? "?";
      const to = lessonIdToTitle.get(edge.toLessonId) ?? "?";
      const rel = edge.relationship !== "prerequisite" ? ` (${edge.relationship})` : "";
      lines.push(`- ${from} → ${to}${rel}`);
    }
    lines.push("");
  }

  // Lessons
  for (const lesson of data.lessons) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${lesson.orderIndex}. ${lesson.title}`);
    lines.push("");
    if (lesson.isSupplementary) {
      lines.push("*Supplementary lesson*");
      lines.push("");
    }
    lines.push(`> ${lesson.summary}`);
    lines.push("");

    // Parse lesson content
    if (lesson.contentJson) {
      try {
        const content = JSON.parse(lesson.contentJson) as LessonContent;
        renderLessonContent(lines, content);
      } catch {
        lines.push("*Content could not be parsed.*");
        lines.push("");
      }
    }

    // Quiz
    const activeQuiz = lesson.quizzes.find((q) => q.isActive);
    if (activeQuiz) {
      renderQuiz(lines, activeQuiz);
    }

    // Notes
    if (lesson.notes.length > 0) {
      lines.push("### Notes");
      lines.push("");
      for (const note of lesson.notes) {
        if (note.title) {
          lines.push(`**${note.title}**`);
          lines.push("");
        }
        lines.push(note.content);
        lines.push("");
      }
    }
  }

  // Course-level notes
  const courseNotes = data.notes ?? [];
  if (courseNotes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Course Notes");
    lines.push("");
    for (const note of courseNotes) {
      if (note.title) {
        lines.push(`**${note.title}**`);
        lines.push("");
      }
      lines.push(note.content);
      lines.push("");
    }
  }

  // Completion summary
  if (data.completionSummary?.narrativeMarkdown) {
    lines.push("---");
    lines.push("");
    lines.push("## Completion Summary");
    lines.push("");
    lines.push(data.completionSummary.narrativeMarkdown);
    lines.push("");
  }

  return lines.join("\n");
}

function renderLessonContent(lines: string[], content: LessonContent) {
  // Learning objectives
  if (content.learningObjectives?.length > 0) {
    lines.push("### Learning Objectives");
    lines.push("");
    for (const obj of content.learningObjectives) {
      lines.push(`- ${obj}`);
    }
    lines.push("");
  }

  // Sections
  for (const section of content.sections) {
    renderSection(lines, section);
  }

  // Worked examples
  if (content.workedExamples?.length > 0) {
    lines.push("### Worked Examples");
    lines.push("");
    for (const example of content.workedExamples) {
      lines.push(`#### ${example.title}`);
      lines.push("");
      lines.push(`**Problem:** ${example.problemStatement}`);
      lines.push("");
      for (let i = 0; i < example.steps.length; i++) {
        const step = example.steps[i];
        lines.push(`**Step ${i + 1}:** ${step.description}`);
        if (step.math) {
          lines.push("");
          lines.push(`$$${step.math}$$`);
        }
        lines.push("");
      }
      lines.push(`**Answer:** ${example.finalAnswer}`);
      lines.push("");
    }
  }

  // Practice exercises
  if (content.practiceExercises?.length > 0) {
    lines.push("### Practice Exercises");
    lines.push("");
    for (let i = 0; i < content.practiceExercises.length; i++) {
      const exercise = content.practiceExercises[i];
      lines.push(`**Exercise ${i + 1}:** ${exercise.problemStatement}`);
      lines.push("");
      if (exercise.choices?.length) {
        for (const choice of exercise.choices) {
          lines.push(`- ${choice.label}`);
        }
        lines.push("");
      }
      if (exercise.hints?.length > 0) {
        lines.push("<details><summary>Hints</summary>");
        lines.push("");
        for (const hint of exercise.hints) {
          lines.push(`- ${hint}`);
        }
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
      lines.push("<details><summary>Solution</summary>");
      lines.push("");
      lines.push(exercise.solution);
      if (exercise.expectedAnswer) {
        lines.push("");
        lines.push(`**Answer:** ${exercise.expectedAnswer}`);
      }
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }

  // Key takeaways
  if (content.keyTakeaways?.length > 0) {
    lines.push("### Key Takeaways");
    lines.push("");
    for (const takeaway of content.keyTakeaways) {
      lines.push(`- ${takeaway}`);
    }
    lines.push("");
  }
}

function renderSection(lines: string[], section: LessonSection) {
  switch (section.type) {
    case "text":
      lines.push(section.content);
      lines.push("");
      break;

    case "math":
      lines.push(`$$${section.latex}$$`);
      if (section.explanation) {
        lines.push("");
        lines.push(section.explanation);
      }
      lines.push("");
      break;

    case "definition":
      lines.push(`**Definition: ${section.term}**`);
      lines.push("");
      lines.push(section.definition);
      if (section.intuition) {
        lines.push("");
        lines.push(`*Intuition:* ${section.intuition}`);
      }
      lines.push("");
      break;

    case "theorem":
      lines.push(`**Theorem: ${section.name}**`);
      lines.push("");
      lines.push(section.statement);
      if (section.proof) {
        lines.push("");
        lines.push("*Proof:*");
        lines.push("");
        lines.push(section.proof);
      }
      if (section.intuition) {
        lines.push("");
        lines.push(`*Intuition:* ${section.intuition}`);
      }
      lines.push("");
      break;

    case "visualization":
      lines.push(`**[Visualization: ${section.caption}]**`);
      lines.push("");
      lines.push(`*Type: ${section.vizType}*`);
      if (section.interactionHint) {
        lines.push(`*${section.interactionHint}*`);
      }
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(section.spec, null, 2));
      lines.push("```");
      lines.push("");
      break;

    case "code_block":
      lines.push(`\`\`\`${section.language}`);
      lines.push(section.code);
      lines.push("```");
      if (section.explanation) {
        lines.push("");
        lines.push(section.explanation);
      }
      lines.push("");
      break;
  }
}

function renderQuiz(
  lines: string[],
  quiz: { questionsJson: string; questionCount: number }
) {
  lines.push("### Quiz");
  lines.push("");
  try {
    const questions = JSON.parse(quiz.questionsJson) as Array<{
      question: string;
      options?: string[];
      correctAnswer?: string;
      explanation?: string;
    }>;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      lines.push(`**Q${i + 1}:** ${q.question}`);
      lines.push("");
      if (q.options?.length) {
        for (const opt of q.options) {
          lines.push(`- ${opt}`);
        }
        lines.push("");
      }
      if (q.correctAnswer || q.explanation) {
        lines.push("<details><summary>Answer</summary>");
        lines.push("");
        if (q.correctAnswer) lines.push(`**Answer:** ${q.correctAnswer}`);
        if (q.explanation) {
          lines.push("");
          lines.push(q.explanation);
        }
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
    }
  } catch {
    lines.push("*Quiz content could not be parsed.*");
    lines.push("");
  }
}
