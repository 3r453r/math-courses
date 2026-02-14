"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface NotebookPage {
  id: string;
  type: "lesson" | "custom";
  lessonId: string | null;
  title: string;
  content: string;
  orderIndex: number;
  updatedAt: string;
}

interface UseNotebookReturn {
  pages: NotebookPage[];
  currentIndex: number;
  currentPage: NotebookPage | null;
  setCurrentIndex: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  isLoading: boolean;
  error: string | null;
  createCustomPage: (orderIndex: number, title?: string) => Promise<void>;
  updatePage: (noteId: string, updates: { title?: string; content?: string }) => Promise<void>;
  deletePage: (noteId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AUTOSAVE_DELAY_MS = 2_000;

export function useNotebook(courseId: string): UseNotebookReturn {
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<{ noteId: string; content: string } | null>(null);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/notebook`);
      if (!res.ok) throw new Error("Failed to fetch notebook");
      const data = await res.json();
      if (isMountedRef.current) {
        setPages(data.pages);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load notebook");
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    fetchPages();
    return () => {
      isMountedRef.current = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [fetchPages]);

  const currentPage = pages[currentIndex] ?? null;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, pages.length - 1));
  }, [pages.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const createCustomPage = useCallback(
    async (orderIndex: number, title?: string) => {
      try {
        const res = await fetch(`/api/courses/${courseId}/notebook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title ?? "Untitled", orderIndex }),
        });
        if (!res.ok) throw new Error("Failed to create page");
        await fetchPages();
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to create page");
        }
      }
    },
    [courseId, fetchPages]
  );

  const flushAutosave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const pending = pendingContentRef.current;
    if (!pending) return;
    pendingContentRef.current = null;
    try {
      await fetch(`/api/courses/${courseId}/notebook/${pending.noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pending.content }),
      });
    } catch {
      // Silently fail — user can retry
    }
  }, [courseId]);

  const updatePage = useCallback(
    async (noteId: string, updates: { title?: string; content?: string }) => {
      // Optimistic update
      setPages((prev) =>
        prev.map((p) => (p.id === noteId ? { ...p, ...updates } : p))
      );

      // If content-only update, debounce autosave
      if (updates.content !== undefined && updates.title === undefined) {
        pendingContentRef.current = { noteId, content: updates.content };
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(async () => {
          const pending = pendingContentRef.current;
          if (!pending || pending.noteId !== noteId) return;
          pendingContentRef.current = null;
          try {
            await fetch(`/api/courses/${courseId}/notebook/${noteId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: pending.content }),
            });
          } catch {
            // Silently fail
          }
        }, AUTOSAVE_DELAY_MS);
        return;
      }

      // Title updates go immediately
      try {
        await flushAutosave();
        const res = await fetch(`/api/courses/${courseId}/notebook/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update page");
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to update page");
        }
      }
    },
    [courseId, flushAutosave]
  );

  const deletePage = useCallback(
    async (noteId: string) => {
      try {
        const res = await fetch(`/api/courses/${courseId}/notebook/${noteId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete page");
        }
        await fetchPages();
        // Adjust index if needed
        setCurrentIndex((i) => Math.min(i, Math.max(0, pages.length - 2)));
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to delete page");
        }
      }
    },
    [courseId, fetchPages, pages.length]
  );

  return {
    pages,
    currentIndex,
    currentPage,
    setCurrentIndex,
    goNext,
    goPrev,
    isLoading,
    error,
    createCustomPage,
    updatePage,
    deletePage,
    refresh: fetchPages,
  };
}
