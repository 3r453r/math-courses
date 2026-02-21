"use client";

import { useTranslation } from "react-i18next";
import { KaTeXBlock } from "@/components/lesson/KaTeXBlock";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import type { MathSection } from "@/types/lesson";

interface Props {
  section: MathSection;
  onChatAbout?: (context: string) => void;
}

export function MathSectionRenderer({ section, onChatAbout }: Props) {
  const { t } = useTranslation("lessonContent");

  return (
    <div className="my-6">
      <KaTeXBlock latex={section.latex} />
      {section.explanation && (
        <MathMarkdown
          content={section.explanation}
          className="mt-2 text-sm text-muted-foreground"
        />
      )}
      {onChatAbout && (
        <div className="flex justify-end mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground gap-1"
            onClick={() =>
              onChatAbout(
                `I'd like to understand this equation:\n\n$$${section.latex}$$`
              )
            }
            data-testid="ask-ai-button"
          >
            <MessageCircleQuestion className="size-3.5" />
            {t("askAi")}
          </Button>
        </div>
      )}
    </div>
  );
}
