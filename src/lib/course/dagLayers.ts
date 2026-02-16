/**
 * Compute DAG layers via BFS topological sort.
 * Lessons are grouped by prerequisite depth — lessons in the same layer
 * can be studied in parallel because they share the same prerequisites.
 */

interface DagLesson {
  id: string;
}

interface DagEdge {
  fromLessonId: string;
  toLessonId: string;
}

export function computeDagLayers<T extends DagLesson>(
  lessons: T[],
  edges: DagEdge[]
): T[][] {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const l of lessons) {
    inDegree.set(l.id, 0);
    children.set(l.id, []);
  }
  for (const e of edges) {
    inDegree.set(e.toLessonId, (inDegree.get(e.toLessonId) ?? 0) + 1);
    children.get(e.fromLessonId)?.push(e.toLessonId);
  }

  const layers: T[][] = [];
  const lessonMap = new Map(lessons.map((l) => [l.id, l]));
  const assigned = new Set<string>();
  let currentLayer = lessons.filter((l) => (inDegree.get(l.id) ?? 0) === 0);

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach((l) => assigned.add(l.id));
    const nextLayer: T[] = [];
    for (const l of currentLayer) {
      for (const childId of children.get(l.id) ?? []) {
        if (assigned.has(childId)) continue;
        const remaining = edges.filter(
          (e) => e.toLessonId === childId && !assigned.has(e.fromLessonId)
        );
        if (remaining.length === 0) {
          const child = lessonMap.get(childId);
          if (child && !nextLayer.find((n) => n.id === childId)) {
            nextLayer.push(child);
          }
        }
      }
    }
    currentLayer = nextLayer;
  }

  // Add any unassigned lessons (orphans) to the last layer
  const orphans = lessons.filter((l) => !assigned.has(l.id));
  if (orphans.length > 0) {
    layers.push(orphans);
  }

  return layers;
}
