"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LessonContentRenderer } from "@/components/lesson/LessonContentRenderer";
import { useLocalScratchpad } from "@/hooks/useLocalScratchpad";
import type { LessonContent } from "@/types/lesson";

interface Props {
  content: LessonContent;
  shareToken: string;
  hasQuiz: boolean;
  onTakeQuiz: () => void;
  onBack: () => void;
}

export function PreviewLessonView({ content, shareToken, hasQuiz, onTakeQuiz, onBack }: Props) {
  const { t } = useTranslation("preview");
  const { content: scratchpadContent, setContent: setScratchpadContent } = useLocalScratchpad(shareToken);
  const [showScratchpad, setShowScratchpad] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; {t("backToOverview")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowScratchpad(!showScratchpad)}
        >
          {t("scratchpad")}
        </Button>
      </div>

      <div className={showScratchpad ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
        <div className="space-y-4">
          <LessonContentRenderer content={content} />
          {hasQuiz && (
            <div className="pt-4 border-t">
              <Button onClick={onTakeQuiz} className="w-full" size="lg">
                {t("takeQuiz")}
              </Button>
            </div>
          )}
        </div>

        {showScratchpad && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("scratchpad")}</h3>
            <p className="text-xs text-muted-foreground">{t("scratchpadLocalNotice")}</p>
            <Textarea
              value={scratchpadContent}
              onChange={(e) => setScratchpadContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Write notes here..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
