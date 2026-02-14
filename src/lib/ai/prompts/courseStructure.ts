export function buildCourseStructurePrompt(params: {
  topic: string;
  description: string;
  focusAreas: string[];
  lessonCount?: number;
  difficulty: string;
}) {
  return `You are a curriculum designer specializing in ${params.topic}, creating a structured course.

TOPIC: ${params.topic}
DESCRIPTION: ${params.description}
FOCUS AREAS: ${params.focusAreas.join(", ") || "General coverage"}
DIFFICULTY LEVEL: ${params.difficulty}
${params.lessonCount ? `TARGET LESSON COUNT: ${params.lessonCount}` : "LESSON COUNT: Suggest the optimal number based on topic breadth (typically 8-20 lessons)"}

CRITICAL RULES:
1. Lessons should form a DIRECTED ACYCLIC GRAPH, not a linear sequence.
   Some lessons can be studied in parallel if they share the same prerequisites.
2. Each lesson should cover ONE coherent concept or technique.
3. Prerequisites must reference earlier lessons (lower orderIndex values).
4. Include at least one "capstone" lesson that synthesizes multiple threads.
5. For the course, aim for 2-4 independent starting points that converge toward later lessons.
6. Order indices must be sequential starting from 0.
7. Every lesson after index 0 must have at least one prerequisite edge.
8. The graph must be connected - every lesson must be reachable from at least one starting lesson.

PEDAGOGICAL GUIDELINES:
- Start with foundational/intuitive concepts before formal definitions.
- Build complexity gradually.
- Include lessons that connect different threads (e.g., applying concepts from one area to problems in another).
- For advanced topics, ensure proper prerequisite chains so students build understanding incrementally.

CONTEXT DOCUMENT GUIDELINES:
In addition to the course structure, generate a pedagogical context document (the contextDoc field).
This document will be used as a style guide when generating individual lessons. It should include:
1. NOTATION CONVENTIONS: Define all notation standards for the course (e.g., variable naming, symbols, formatting conventions specific to the subject).
2. PEDAGOGICAL APPROACH: State the teaching philosophy (e.g., "intuition before formalism", "computational examples first", "theory-driven", etc.).
3. KEY THEMES: Identify recurring themes and connections between lessons.
4. DIFFICULTY CALIBRATION: Describe the expected level of rigor and complexity.
5. STYLE GUIDELINES: How to structure explanations, what level of detail in proofs or derivations, how to balance theory and practice.
Keep it 500-1000 words. Use Markdown formatting.`;
}
