"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

interface ScratchpadNote {
  id: string;
  lessonId: string;
  content: string;
  updatedAt: string;
}

interface UseScratchpadReturn {
  content: string;
  setContent: (content: string) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  save: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AUTOSAVE_DELAY_MS = 30_000;
const SAVED_DISPLAY_MS = 3_000;

export function useScratchpad(lessonId: string): UseScratchpadReturn {
  const [content, setContentState] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const noteIdRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Fetch scratchpad on mount / lessonId change
  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);
    setSaveStatus("idle");
    noteIdRef.current = null;

    fetch(`/api/notes/scratchpad?lessonId=${encodeURIComponent(lessonId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch scratchpad");
        return res.json();
      })
      .then((note: ScratchpadNote) => {
        if (!isMountedRef.current) return;
        noteIdRef.current = note.id;
        setContentState(note.content);
        lastSavedContentRef.current = note.content;
        if (note.updatedAt) setLastSavedAt(new Date(note.updatedAt));
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [lessonId]);

  // Save function
  const save = useCallback(async () => {
    if (!noteIdRef.current) return;

    // Clear any pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/notes/scratchpad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: noteIdRef.current,
          content: content,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const updated: ScratchpadNote = await res.json();

      if (!isMountedRef.current) return;
      lastSavedContentRef.current = updated.content;
      setLastSavedAt(new Date(updated.updatedAt));
      setSaveStatus("saved");

      // Fade back to idle after a few seconds
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
      savedFadeTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setSaveStatus("idle");
      }, SAVED_DISPLAY_MS);
    } catch (err) {
      if (!isMountedRef.current) return;
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }, [content]);

  // Content setter that also triggers dirty state + autosave debounce
  const setContent = useCallback(
    (newContent: string) => {
      setContentState(newContent);

      if (newContent !== lastSavedContentRef.current) {
        setSaveStatus("unsaved");

        // Reset autosave debounce
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
          // We can't call save() directly here because it captures stale content.
          // Instead, we set a flag that the effect below will pick up.
          // Actually, let's use a ref-based approach:
          autosaveTimerRef.current = null;
        }, AUTOSAVE_DELAY_MS);
      } else {
        setSaveStatus("idle");
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
      }
    },
    []
  );

  // Autosave effect — watches for the debounce timer expiring
  useEffect(() => {
    if (saveStatus !== "unsaved") return;
    if (!noteIdRef.current) return;

    const timer = setTimeout(async () => {
      if (!isMountedRef.current || !noteIdRef.current) return;
      // Check if still dirty
      if (content === lastSavedContentRef.current) return;

      setSaveStatus("saving");
      try {
        const res = await fetch("/api/notes/scratchpad", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: noteIdRef.current, content }),
        });
        if (!res.ok) throw new Error("Autosave failed");
        const updated: ScratchpadNote = await res.json();
        if (!isMountedRef.current) return;
        lastSavedContentRef.current = updated.content;
        setLastSavedAt(new Date(updated.updatedAt));
        setSaveStatus("saved");
        if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
        savedFadeTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setSaveStatus("idle");
        }, SAVED_DISPLAY_MS);
      } catch {
        if (isMountedRef.current) setSaveStatus("error");
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [content, saveStatus]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    };
  }, []);

  return { content, setContent, saveStatus, lastSavedAt, save, isLoading, error };
}
