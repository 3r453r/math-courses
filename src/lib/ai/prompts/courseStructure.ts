export function buildCourseStructurePrompt(params: {
  topic: string;
  description: string;
  focusAreas: string[];
  lessonCount?: number;
  difficulty: string;
}) {
  return `You are a mathematics curriculum designer creating a structured course.

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

IMPORTANT FOR MATH COURSES:
- Start with foundational/intuitive concepts before formal definitions.
- Build complexity gradually.
- Include lessons that connect different threads (e.g., applying algebra concepts to geometric problems).
- For advanced topics like differential geometry, ensure proper prerequisite chains (topology basics → smooth manifolds → tangent spaces → etc.).`;
}
