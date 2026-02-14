"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useScratchpad } from "@/hooks/useScratchpad";
import { ScratchpadEditor } from "./ScratchpadEditor";
import type { ScratchpadEditorHandle } from "./ScratchpadEditor";
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
  const { t } = useTranslation("scratchpad");
  const timeStr = useMemo(() => {
    if (!lastSavedAt) return null;
    return lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSavedAt]);

  switch (status) {
    case "idle":
      return timeStr ? (
        <span className="text-xs text-muted-foreground">{t("savedAt", { time: timeStr })}</span>
      ) : null;
    case "unsaved":
      return (
        <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-yellow-500 inline-block" />
          {t("unsaved")}
        </span>
      );
    case "saving":
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="size-3 animate-spin inline-block">&#9696;</span>
          {t("saving")}
        </span>
      );
    case "saved":
      return (
        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {t("saved")}
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-red-500 inline-block" />
          {t("saveFailed")}
        </span>
      );
  }
}

export function ScratchpadPanel({ lessonId, onClose }: ScratchpadPanelProps) {
  const { t } = useTranslation(["scratchpad", "common"]);
  const { content, setContent, saveStatus, lastSavedAt, save, isLoading, error } =
    useScratchpad(lessonId);
  const [activeTab, setActiveTab] = useState("split");
  const editorRef = useRef<ScratchpadEditorHandle>(null);

  // Debounced preview content — reacts to ALL content changes including initial fetch
  const [previewContent, setPreviewContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // In preview-only mode, update immediately
    if (activeTab === "preview") {
      setPreviewContent(content);
      return;
    }
    // In split/write mode, debounce by 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewContent(content), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, activeTab]);

  const handleInsertSymbol = (text: string, cursorOffset: number) => {
    editorRef.current?.insertAtCursor(text, cursorOffset);
  };

  if (isLoading) {
    return (
      <div className="w-full border-l bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("scratchpad:loadingScratchpad")}</p>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="w-full border-l bg-background flex flex-col items-center justify-center gap-2 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("common:close")}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{t("scratchpad:scratchpad")}</h3>
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
        <div className="flex items-center gap-1">
          {saveStatus === "error" && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={save}>
              {t("common:retry")}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClose}>
            ✕
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-2 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="write" className="flex-1">{t("scratchpad:write")}</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">{t("scratchpad:preview")}</TabsTrigger>
            <TabsTrigger value="split" className="flex-1">{t("scratchpad:split")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="write" className="flex-1 min-h-0 flex flex-col">
          <ScratchpadEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            onSave={save}
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0 flex flex-col">
          <ScratchpadPreview content={previewContent} />
        </TabsContent>

        <TabsContent value="split" className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b flex flex-col relative">
              <ScratchpadEditor
                ref={editorRef}
                value={content}
                onChange={setContent}
                onSave={save}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-auto flex flex-col">
              <ScratchpadPreview content={previewContent} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Toolbar */}
      <div className="shrink-0">
        <ScratchpadToolbar onInsertSymbol={handleInsertSymbol} />
      </div>
    </div>
  );
}
