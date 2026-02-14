"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { QuizQuestion, QuizAnswers } from "@/types/quiz";

interface Props {
  questions: QuizQuestion[];
  onSubmit: (answers: QuizAnswers) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function QuizRunner({ questions, onSubmit, isSubmitting, disabled }: Props) {
  const { t } = useTranslation("quiz");
  const [answers, setAnswers] = useState<QuizAnswers>({});

  const answeredCount = Object.keys(answers).filter(
    (qId) => answers[qId] && answers[qId].length > 0
  ).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  function toggleChoice(questionId: string, choiceId: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(choiceId)
        ? current.filter((id) => id !== choiceId)
        : [...current, choiceId];
      return { ...prev, [questionId]: next };
    });
  }

  function handleSubmit() {
    onSubmit(answers);
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            {t("answeredOf", { answered: answeredCount, total: questions.length })}
          </p>
          <p className="text-sm font-medium">{Math.round(progress)}%</p>
        </div>
        <Progress value={progress} />
      </div>

      {/* Questions */}
      {questions.map((question, qIdx) => {
        const selected = answers[question.id] ?? [];
        return (
          <Card key={question.id} id={`question-${question.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {t("qNumber", { number: qIdx + 1 })}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {question.topic}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    question.difficulty === "easy"
                      ? "text-green-700 border-green-300"
                      : question.difficulty === "hard"
                        ? "text-red-700 border-red-300"
                        : "text-yellow-700 border-yellow-300"
                  }
                >
                  {question.difficulty}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <MathMarkdown content={question.questionText} />
              <div className="space-y-2">
                {question.choices.map((choice) => {
                  const isSelected = selected.includes(choice.id);
                  return (
                    <div
                      key={choice.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => !disabled && toggleChoice(question.id, choice.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <Label className="cursor-pointer flex-1 font-normal">
                        <MathMarkdown content={choice.text} className="text-sm" />
                      </Label>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Submit */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || disabled || answeredCount === 0}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin mr-2">&#9696;</span>
              {t("scoring")}
            </>
          ) : (
            t("submitQuiz", { answered: answeredCount, total: questions.length })
          )}
        </Button>
      </div>
    </div>
  );
}
