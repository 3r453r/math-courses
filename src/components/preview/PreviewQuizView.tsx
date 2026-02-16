"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { PreviewQuizCTA } from "./PreviewQuizCTA";
import type { QuizQuestion, QuizAnswers, QuizResult } from "@/types/quiz";

interface Props {
  questions: QuizQuestion[];
  shareToken: string;
  onBack: () => void;
}

export function PreviewQuizView({ questions, shareToken, onBack }: Props) {
  const { t } = useTranslation("preview");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(answers: QuizAnswers) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/preview/${shareToken}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Failed to score quiz");
      const data: QuizResult = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Failed to score preview quiz:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; {t("backToOverview")}
        </Button>
        <PreviewQuizCTA result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        &larr; {t("backToOverview")}
      </Button>
      <QuizRunner
        questions={questions}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
