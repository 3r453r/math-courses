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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MathMarkdown } from "./MathMarkdown";
import type { PracticeExercise as PracticeExerciseType } from "@/types/lesson";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useApiHeaders } from "@/hooks/useApiHeaders";

interface Props {
  exercise: PracticeExerciseType;
  index: number;
}

interface CheckResult {
  score: number;
  feedback: string;
  keyPointsMet: string[];
}

export function PracticeExercise({ exercise, index }: Props) {
  const { t } = useTranslation("lessonContent");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);

  const apiKeys = useAppStore((s) => s.apiKeys);
  const freeResponseCheckMode = useAppStore((s) => s.freeResponseCheckMode);
  const generationModel = useAppStore((s) => s.generationModel);
  const apiHeaders = useApiHeaders();

  const hasApiKey = !!(apiKeys.anthropic || apiKeys.openai || apiKeys.google);

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

  async function handleSubmit() {
    if (exercise.answerType === "free_response") {
      if (!hasApiKey || freeResponseCheckMode === "solution") {
        setSubmitted(true);
        setShowSolution(true);
        if (!hasApiKey) setNoApiKey(true);
        return;
      }

      // AI mode
      setIsChecking(true);
      setSubmitted(true);
      try {
        const res = await fetch("/api/practice/check", {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            questionText: exercise.problemStatement,
            studentAnswer: userAnswer,
            solution: exercise.solution,
            keyPoints: exercise.keyPoints ?? [],
            model: generationModel,
          }),
        });
        if (res.ok) {
          const data = await res.json() as CheckResult;
          setCheckResult(data);
        } else {
          setShowSolution(true);
        }
      } catch {
        setShowSolution(true);
      } finally {
        setIsChecking(false);
      }
      return;
    }

    setSubmitted(true);
  }

  function handleReset() {
    setSubmitted(false);
    setUserAnswer("");
    setSelectedChoice(null);
    setShowSolution(false);
    setHintsRevealed(0);
    setCheckResult(null);
    setIsChecking(false);
    setNoApiKey(false);
  }

  const scorePercent = checkResult ? Math.round(checkResult.score * 100) : null;
  const scoreBadgeVariant =
    scorePercent === null
      ? "secondary"
      : scorePercent >= 80
      ? "default"
      : scorePercent >= 50
      ? "secondary"
      : "destructive";

  const keyPointsNotMet =
    checkResult && exercise.keyPoints
      ? exercise.keyPoints.filter((kp) => !checkResult.keyPointsMet.includes(kp))
      : [];

  return (
    <Card className="my-6 border-l-4 border-l-emerald-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700"
          >
            {t("exercise", { number: index + 1 })}
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">
            {exercise.answerType.replace("_", " ")}
          </Badge>
          {exercise.answerType === "free_response" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-medium cursor-help select-none">
                    ?
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t("freeResponseAiHint")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
          <>
            <textarea
              className="w-full min-h-[100px] p-3 rounded-lg border bg-background text-sm resize-y"
              placeholder={t("freeResponsePlaceholder")}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={submitted}
            />

            {isChecking && (
              <p className="text-sm text-muted-foreground animate-pulse">
                {t("checkingAnswer")}
              </p>
            )}

            {checkResult && !isChecking && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={scoreBadgeVariant}>
                    {t("aiScore", { percent: scorePercent })}
                  </Badge>
                </div>
                <p className="text-sm">{checkResult.feedback}</p>

                {exercise.keyPoints && exercise.keyPoints.length > 0 && (
                  <div className="space-y-1">
                    {checkResult.keyPointsMet.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("keyPointsMet")}
                        </p>
                        <ul className="space-y-0.5">
                          {checkResult.keyPointsMet.map((kp, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1.5 text-sm text-green-700 dark:text-green-400"
                            >
                              <span className="mt-0.5 shrink-0">✓</span>
                              <MathMarkdown content={kp} className="text-sm" />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {keyPointsNotMet.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground mt-2">
                          {t("keyPointsNotMet")}
                        </p>
                        <ul className="space-y-0.5">
                          {keyPointsNotMet.map((kp, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1.5 text-sm text-muted-foreground"
                            >
                              <span className="mt-0.5 shrink-0">○</span>
                              <MathMarkdown content={kp} className="text-sm" />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {noApiKey && submitted && (
              <p className="text-xs text-muted-foreground">
                {t("addApiKeyForFeedback")}
              </p>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!submitted && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                isChecking ||
                (exercise.answerType === "multiple_choice" &&
                  !selectedChoice) ||
                (exercise.answerType === "numeric" && !userAnswer.trim()) ||
                (exercise.answerType === "free_response" && !userAnswer.trim())
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
