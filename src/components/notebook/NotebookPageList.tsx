"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NotebookPage } from "@/hooks/useNotebook";

interface NotebookPageListProps {
  pages: NotebookPage[];
  currentIndex: number;
  onSelectPage: (index: number) => void;
  onInsertPage: (orderIndex: number) => void;
  courseId: string;
}

export function NotebookPageList({
  pages,
  currentIndex,
  onSelectPage,
  onInsertPage,
  courseId,
}: NotebookPageListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        {/* Insert at top */}
        <InsertButton
          onClick={() => {
            const firstOrder = pages[0]?.orderIndex ?? 1;
            onInsertPage(firstOrder - 0.5);
          }}
        />

        {pages.map((page, idx) => (
          <div key={page.id}>
            <button
              onClick={() => onSelectPage(idx)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                idx === currentIndex
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {page.type === "lesson" ? (
                  <svg
                    className="size-3 shrink-0 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                ) : (
                  <svg
                    className="size-3 shrink-0 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                )}
                <span className="truncate">{page.title}</span>
              </div>
              {page.type === "lesson" && (
                <a
                  href={`/courses/${courseId}/lessons/${page.lessonId}`}
                  className="text-[10px] text-muted-foreground hover:text-primary hover:underline ml-4.5 block"
                  onClick={(e) => e.stopPropagation()}
                >
                  Go to lesson
                </a>
              )}
            </button>

            {/* Insert button between pages */}
            <InsertButton
              onClick={() => {
                const nextOrder = pages[idx + 1]?.orderIndex ?? page.orderIndex + 1;
                onInsertPage((page.orderIndex + nextOrder) / 2);
              }}
            />
          </div>
        ))}

        {pages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 px-2">
            No pages yet. Lesson scratchpad notes will appear here automatically.
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-0.5 group">
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
        onClick={onClick}
        title="Insert custom page"
      >
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </Button>
    </div>
  );
}
