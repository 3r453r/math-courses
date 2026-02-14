"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNotebook } from "@/hooks/useNotebook";
import { ScratchpadEditor } from "@/components/scratchpad/ScratchpadEditor";
import type { ScratchpadEditorHandle } from "@/components/scratchpad/ScratchpadEditor";
import { ScratchpadPreview } from "@/components/scratchpad/ScratchpadPreview";
import { ScratchpadToolbar } from "@/components/scratchpad/ScratchpadToolbar";
import { NotebookPageList } from "./NotebookPageList";
import { NotebookPageNav } from "./NotebookPageNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface NotebookPanelProps {
  courseId: string;
  onClose: () => void;
}

export function NotebookPanel({ courseId, onClose }: NotebookPanelProps) {
  const { t } = useTranslation(["notebook", "scratchpad", "common"]);
  const {
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
  } = useNotebook(courseId);

  const [activeTab, setActiveTab] = useState("split");
  const editorRef = useRef<ScratchpadEditorHandle>(null);

  // Debounced preview content
  const [previewContent, setPreviewContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = currentPage?.content ?? "";

  useEffect(() => {
    if (activeTab === "preview") {
      setPreviewContent(content);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewContent(content), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, activeTab]);

  const handleContentChange = (newContent: string) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { content: newContent });
  };

  const handleTitleChange = (newTitle: string) => {
    if (!currentPage || currentPage.type !== "custom") return;
    updatePage(currentPage.id, { title: newTitle });
  };

  const handleInsertSymbol = (text: string, cursorOffset: number) => {
    editorRef.current?.insertAtCursor(text, cursorOffset);
  };

  const handleSave = async () => {
    if (!currentPage) return;
    await updatePage(currentPage.id, { content: currentPage.content });
  };

  // Is the current page editable (only custom pages can edit title)
  const isCustom = currentPage?.type === "custom";

  if (isLoading) {
    return (
      <div className="w-full border-l bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("notebook:loadingNotebook")}</p>
      </div>
    );
  }

  if (error && pages.length === 0) {
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
        <h3 className="text-sm font-medium">{t("notebook:notebook")}</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* Body: sidebar + editor */}
      <div className="flex-1 flex min-h-0">
        {/* Page list sidebar */}
        <div className="w-48 border-r shrink-0 flex flex-col min-h-0">
          <NotebookPageList
            pages={pages}
            currentIndex={currentIndex}
            onSelectPage={setCurrentIndex}
            onInsertPage={(orderIndex) => createCustomPage(orderIndex)}
            courseId={courseId}
          />
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-h-0">
          {currentPage ? (
            <>
              {/* Page title */}
              <div className="px-3 py-2 border-b shrink-0">
                {isCustom ? (
                  <input
                    type="text"
                    value={currentPage.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="text-sm font-medium bg-transparent border-none outline-none w-full placeholder:text-muted-foreground"
                    placeholder={t("notebook:pageTitlePlaceholder")}
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">{currentPage.title}</p>
                )}
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
                    onChange={handleContentChange}
                    onSave={handleSave}
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
                        onChange={handleContentChange}
                        onSave={handleSave}
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

              {/* Delete button for custom pages */}
              {isCustom && (
                <div className="px-3 py-1 border-t shrink-0 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={() => deletePage(currentPage.id)}
                  >
                    {t("notebook:deletePage")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {pages.length === 0
                ? t("notebook:noPagesPrompt")
                : t("notebook:selectAPage")}
            </div>
          )}

          {/* Navigation */}
          <NotebookPageNav
            currentIndex={currentIndex}
            totalPages={pages.length}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
      </div>
    </div>
  );
}
