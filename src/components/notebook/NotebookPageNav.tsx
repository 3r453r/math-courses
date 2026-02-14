"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface NotebookPageNavProps {
  currentIndex: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function NotebookPageNav({
  currentIndex,
  totalPages,
  onPrev,
  onNext,
}: NotebookPageNavProps) {
  const { t } = useTranslation("common");

  if (totalPages === 0) return null;

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onPrev}
        disabled={currentIndex <= 0}
      >
        &larr; {t("previous")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {currentIndex + 1} / {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onNext}
        disabled={currentIndex >= totalPages - 1}
      >
        {t("next")} &rarr;
      </Button>
    </div>
  );
}
