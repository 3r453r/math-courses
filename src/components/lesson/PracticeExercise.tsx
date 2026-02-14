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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MathMarkdown } from "./MathMarkdown";
import type { PracticeExercise as PracticeExerciseType } from "@/types/lesson";
import { cn } from "@/lib/utils";

interface Props {
  exercise: PracticeExerciseType;
  index: number;
}

export function PracticeExercise({ exercise, index }: Props) {
  const { t } = useTranslation("lessonContent");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = (() => {
    if (!submitted) return null;
    if (exercise.answerType === "multiple_choice" && exercise.choices) {
      const chosen = exercise.choices.find((c) => c.label === selectedChoice);
      return chosen?.correct ?? false;
    }
    if (exercise.answerType === "numeric" && exercise.expectedAnswer) {
      const expected = parseFloat(exercise.expectedAnswer);
      const actual = parseFloat(userAnswer);
      return !isNaN(expected) && !isNaN(actual) && Math.abs(expected - actual) < 0.01;
    }
    return null;
  })();

  function handleSubmit() {
    setSubmitted(true);
  }

  function handleReset() {
    setSubmitted(false);
    setUserAnswer("");
    setSelectedChoice(null);
    setShowSolution(false);
    setHintsRevealed(0);
  }

  return (
    <Card className="my-6 border-l-4 border-l-emerald-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-300"
          >
            {t("exercise", { number: index + 1 })}
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">
            {exercise.answerType.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MathMarkdown content={exercise.problemStatement} />

        {/* Multiple choice */}
        {exercise.answerType === "multiple_choice" && exercise.choices && (
          <RadioGroup
            value={selectedChoice ?? undefined}
            onValueChange={setSelectedChoice}
            disabled={submitted}
          >
            {exercise.choices.map((choice, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg",
                  submitted &&
                    choice.correct &&
                    "bg-green-50 dark:bg-green-950/30",
                  submitted &&
                    selectedChoice === choice.label &&
                    !choice.correct &&
                    "bg-red-50 dark:bg-red-950/30"
                )}
              >
                <RadioGroupItem
                  value={choice.label}
                  id={`${exercise.id}-${i}`}
                />
                <Label
                  htmlFor={`${exercise.id}-${i}`}
                  className="cursor-pointer flex-1"
                >
                  <MathMarkdown content={choice.label} className="text-sm" />
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* Numeric input */}
        {exercise.answerType === "numeric" && (
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder={t("numericPlaceholder")}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={submitted}
              className="max-w-xs"
            />
            {submitted && isCorrect !== null && (
              <Badge variant={isCorrect ? "default" : "destructive"}>
                {isCorrect ? t("correctBadge") : t("incorrectBadge")}
              </Badge>
            )}
          </div>
        )}

        {/* Free response */}
        {exercise.answerType === "free_response" && (
          <textarea
            className="w-full min-h-[100px] p-3 rounded-lg border bg-background text-sm resize-y"
            placeholder={t("freeResponsePlaceholder")}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={submitted}
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!submitted && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                (exercise.answerType === "multiple_choice" &&
                  !selectedChoice) ||
                (exercise.answerType === "numeric" && !userAnswer.trim())
              }
            >
              {t("checkAnswer")}
            </Button>
          )}
          {submitted && (
            <Button size="sm" variant="outline" onClick={handleReset}>
              {t("tryAgain")}
            </Button>
          )}
          {exercise.hints.length > 0 &&
            hintsRevealed < exercise.hints.length && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHintsRevealed((prev) => prev + 1)}
              >
                {t("hint", { current: hintsRevealed, total: exercise.hints.length })}
              </Button>
            )}
          {!showSolution && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSolution(true)}
            >
              {t("showSolution")}
            </Button>
          )}
        </div>

        {/* Hints */}
        {hintsRevealed > 0 && (
          <div className="space-y-2">
            {exercise.hints.slice(0, hintsRevealed).map((hint, i) => (
              <div
                key={i}
                className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800"
              >
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                  {t("hintLabel", { number: i + 1 })}
                </p>
                <MathMarkdown content={hint} className="text-sm" />
              </div>
            ))}
          </div>
        )}

        {/* Solution */}
        {showSolution && (
          <>
            <Separator />
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {t("solution")}
              </p>
              <MathMarkdown content={exercise.solution} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
