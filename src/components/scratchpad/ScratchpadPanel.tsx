"use client";

import { useState, useMemo } from "react";
import { useScratchpad } from "@/hooks/useScratchpad";
import { ScratchpadEditor } from "./ScratchpadEditor";
import { ScratchpadPreview } from "./ScratchpadPreview";
import { ScratchpadToolbar } from "./ScratchpadToolbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SaveStatus } from "@/hooks/useScratchpad";

interface ScratchpadPanelProps {
  lessonId: string;
  onClose: () => void;
}

function SaveStatusIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: Date | null }) {
  const timeStr = useMemo(() => {
    if (!lastSavedAt) return null;
    return lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSavedAt]);

  switch (status) {
    case "idle":
      return timeStr ? (
        <span className="text-xs text-muted-foreground">Saved {timeStr}</span>
      ) : null;
    case "unsaved":
      return (
        <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-yellow-500 inline-block" />
          Unsaved
        </span>
      );
    case "saving":
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="size-3 animate-spin inline-block">&#9696;</span>
          Saving...
        </span>
      );
    case "saved":
      return (
        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-500 inline-block" />
          Save failed
        </span>
      );
  }
}

export function ScratchpadPanel({ lessonId, onClose }: ScratchpadPanelProps) {
  const { content, setContent, saveStatus, lastSavedAt, save, isLoading, error } =
    useScratchpad(lessonId);
  const [activeTab, setActiveTab] = useState("split");

  // Debounce preview to avoid excessive re-renders during typing
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Debounce preview update by 300ms
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(
      setTimeout(() => setDebouncedContent(newContent), 300)
    );
  };

  // On initial load or tab switch, sync debounced content immediately
  const previewContent = activeTab === "preview" ? content : debouncedContent;

  if (isLoading) {
    return (
      <div className="w-[480px] border-l bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading scratchpad...</p>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="w-[480px] border-l bg-background flex flex-col items-center justify-center gap-2 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[480px] border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Scratchpad</h3>
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
        <div className="flex items-center gap-1">
          {saveStatus === "error" && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={save}>
              Retry
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setDebouncedContent(content); }} className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-2 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="write" className="flex-1">Write</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
            <TabsTrigger value="split" className="flex-1">Split</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="write" className="flex-1 min-h-0">
          <ScratchpadEditor
            value={content}
            onChange={handleContentChange}
            onSave={save}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0">
          <ScratchpadPreview content={previewContent} className="h-full" />
        </TabsContent>

        <TabsContent value="split" className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b">
              <ScratchpadEditor
                value={content}
                onChange={handleContentChange}
                onSave={save}
                className="h-full"
              />
            </div>
            <div className="flex-1 min-h-0">
              <ScratchpadPreview content={previewContent} className="h-full" />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Toolbar */}
      <div className="shrink-0">
        <ScratchpadToolbar />
      </div>
    </div>
  );
}
