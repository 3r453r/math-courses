"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

interface DAGLesson {
  id: string;
  title: string;
  summary: string;
  orderIndex: number;
  status: string;
}

interface DAGEdge {
  fromLessonId: string;
  toLessonId: string;
}

interface Props {
  lessons: DAGLesson[];
  edges: DAGEdge[];
  previewLessonId: string;
  onPreviewClick: () => void;
}

export function LockedDAGView({ lessons, edges, previewLessonId, onPreviewClick }: Props) {
  const { t } = useTranslation("preview");

  const layers = useMemo(() => {
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
    const result: DAGLesson[][] = [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));
    const assigned = new Set<string>();
    let currentLayer = lessons.filter((l) => (inDegree.get(l.id) ?? 0) === 0);
    while (currentLayer.length > 0) {
      result.push(currentLayer);
      currentLayer.forEach((l) => assigned.add(l.id));
      const nextLayer: DAGLesson[] = [];
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
    const orphans = lessons.filter((l) => !assigned.has(l.id));
    if (orphans.length > 0) result.push(orphans);
    return result;
  }, [lessons, edges]);

  return (
    <div className="space-y-6">
      {layers.map((layer, layerIdx) => (
        <div key={layerIdx}>
          {layerIdx > 0 && (
            <div className="flex justify-center py-2">
              <div className="text-muted-foreground text-xs">&#x25BC;</div>
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            {layer.map((lesson) => {
              const isPreview = lesson.id === previewLessonId;
              return (
                <button
                  key={lesson.id}
                  onClick={isPreview ? onPreviewClick : undefined}
                  disabled={!isPreview}
                  className={`
                    p-3 rounded-lg border-2 text-left
                    min-w-[200px] max-w-[280px]
                    transition-all
                    ${isPreview
                      ? "bg-amber-50 text-amber-900 border-amber-400 hover:shadow-md hover:scale-[1.02] cursor-pointer dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-600"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono opacity-60">
                      #{lesson.orderIndex}
                    </span>
                    {isPreview ? (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t("clickToPreview")}
                      </span>
                    ) : (
                      <Lock className="size-3.5 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <p className="font-medium text-sm mt-1 leading-tight">
                    {lesson.title}
                  </p>
                  <p className="text-xs mt-1 opacity-70 line-clamp-2">
                    {lesson.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
