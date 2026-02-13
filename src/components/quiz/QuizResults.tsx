"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { QuizQuestion, QuizAnswers, QuizResult } from "@/types/quiz";
import { cn } from "@/lib/utils";

interface Props {
  questions: QuizQuestion[];
  answers: QuizAnswers;
  result: QuizResult;
  onAction?: (action: string, payload?: unknown) => void;
  variant: "lesson" | "diagnostic";
  prerequisites?: { topic: string; importance: string; description: string }[];
  isRegenerating?: boolean;
  isAddingPrereqs?: boolean;
}

export function QuizResults({
  questions,
  answers,
  result,
  onAction,
  variant,
  prerequisites,
  isRegenerating,
  isAddingPrereqs,
}: Props) {
  const [showReview, setShowReview] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(() => {
    if (variant === "diagnostic" && result.weakTopics.length > 0) {
      return new Set(result.weakTopics);
    }
    return new Set();
  });
  const percentage = Math.round(result.score * 100);

  const scoreColor =
    result.score >= 0.8
      ? "text-green-600"
      : result.score >= 0.5
        ? "text-yellow-600"
        : "text-red-600";

  const recommendationConfig = {
    advance: {
      title: "Great work!",
      description: "You demonstrated strong understanding. You're ready to move on.",
      color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    },
    supplement: {
      title: "Good progress, with some gaps",
      description:
        "You understand the core concepts but have weak spots. Consider reviewing the topics below before continuing.",
      color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
    },
    regenerate: {
      title: "More practice needed",
      description:
        "The results suggest significant gaps in understanding. Consider re-studying the material or trying a different approach.",
      color: "border-red-500 bg-red-50 dark:bg-red-950/30",
    },
  };

  const rec = recommendationConfig[result.recommendation];

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold">
                <span className={scoreColor}>{percentage}%</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {questions.filter((q) => {
                  const correctIds = q.choices.filter((c) => c.correct).map((c) => c.id);
                  const userIds = answers[q.id] ?? [];
                  return (
                    correctIds.length === userIds.length &&
                    correctIds.every((id) => userIds.includes(id))
                  );
                }).length}{" "}
                of {questions.length} correct
              </p>
            </div>
          </div>
          <Progress value={percentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Alert className={cn("border-l-4", rec.color)}>
        <AlertTitle>{rec.title}</AlertTitle>
        <AlertDescription>{rec.description}</AlertDescription>
      </Alert>

      {/* Topic breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {variant === "diagnostic" ? "Prerequisite Breakdown" : "Topic Breakdown"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(result.topicScores).map(([topic, score]) => {
            const pct = Math.round(score * 100);
            const isWeak = result.weakTopics.includes(topic);
            return (
              <div key={topic}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{topic}</span>
                    {isWeak && (
                      <Badge variant="destructive" className="text-xs">
                        Weak
                      </Badge>
                    )}
                    {variant === "diagnostic" && prerequisites && (
                      <Badge variant="outline" className="text-xs">
                        {prerequisites.find((p) => p.topic === topic)?.importance ?? ""}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{pct}%</span>
                </div>
                <Progress
                  value={pct}
                  className={cn("h-2", isWeak && "[&_[data-slot=progress-indicator]]:bg-red-500")}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Prerequisite lesson selection (diagnostic only, when weak topics exist) */}
      {variant === "diagnostic" &&
        (result.recommendation === "supplement" || result.recommendation === "regenerate") &&
        result.weakTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Prerequisite Lessons</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select weak topics to add as new lessons before your course content.
              These will appear at the beginning of your course.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.weakTopics.map((topic) => {
              const prereq = prerequisites?.find((p) => p.topic === topic);
              const score = result.topicScores[topic];
              const pct = Math.round((score ?? 0) * 100);
              const isSelected = selectedTopics.has(topic);

              return (
                <div
                  key={topic}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    isSelected ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  )}
                  onClick={() => toggleTopic(topic)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleTopic(topic)}
                    className="mt-0.5"
                  />
                  <Label className="cursor-pointer flex-1 font-normal">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{topic}</span>
                      <Badge variant="destructive" className="text-xs">{pct}%</Badge>
                      {prereq && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {prereq.importance}
                        </Badge>
                      )}
                    </div>
                    {prereq?.description && (
                      <p className="text-xs text-muted-foreground mt-1">{prereq.description}</p>
                    )}
                  </Label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {onAction && (
        <div className="flex flex-wrap gap-3">
          {variant === "lesson" && (
            <>
              {result.recommendation === "advance" && (
                <Button onClick={() => onAction("advance")}>
                  Continue to Next Lesson
                </Button>
              )}
              {(result.recommendation === "supplement" ||
                result.recommendation === "regenerate") && (
                <>
                  <Button onClick={() => onAction("regenerate")} disabled={isRegenerating}>
                    {isRegenerating ? (
                      <>
                        <span className="animate-spin mr-2">&#9696;</span>
                        Regenerating Lesson...
                      </>
                    ) : (
                      "Regenerate Lesson"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => onAction("advance")}>
                    Continue Anyway
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => onAction("retake")}>
                Retake Quiz
              </Button>
            </>
          )}
          {variant === "diagnostic" && (
            <>
              {selectedTopics.size > 0 && (
                <Button
                  onClick={() => {
                    const topics = result.weakTopics
                      .filter((t) => selectedTopics.has(t))
                      .map((t) => ({
                        title: t,
                        summary:
                          prerequisites?.find((p) => p.topic === t)?.description ??
                          `Prerequisite: ${t}`,
                      }));
                    onAction("add-prerequisites", { topics });
                  }}
                  disabled={isAddingPrereqs}
                >
                  {isAddingPrereqs ? (
                    <>
                      <span className="animate-spin mr-2">&#9696;</span>
                      Adding Prerequisite Lessons...
                    </>
                  ) : (
                    `Add ${selectedTopics.size} Prerequisite Lesson${selectedTopics.size > 1 ? "s" : ""} & Start`
                  )}
                </Button>
              )}
              <Button
                variant={selectedTopics.size > 0 ? "outline" : "default"}
                onClick={() => onAction("start")}
              >
                {selectedTopics.size > 0 ? "Start Without Prerequisites" : "Start Course"}
              </Button>
              <Button variant="outline" onClick={() => onAction("retake")}>
                Retake Diagnostic
              </Button>
            </>
          )}
        </div>
      )}

      {/* Question review toggle */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setShowReview(!showReview)}
          className="w-full"
        >
          {showReview ? "Hide" : "Show"} Question Review
        </Button>
      </div>

      {/* Question review */}
      {showReview && (
        <div className="space-y-4">
          <Separator />
          <h3 className="font-semibold">Question Review</h3>
          {questions.map((question, qIdx) => {
            const userIds = answers[question.id] ?? [];
            const correctIds = question.choices
              .filter((c) => c.correct)
              .map((c) => c.id);
            const isCorrect =
              correctIds.length === userIds.length &&
              correctIds.every((id) => userIds.includes(id));

            return (
              <Card
                key={question.id}
                className={cn(
                  "border-l-4",
                  isCorrect ? "border-l-green-500" : "border-l-red-500"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={isCorrect ? "default" : "destructive"}>
                      Q{qIdx + 1}: {isCorrect ? "Correct" : "Incorrect"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {question.topic}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MathMarkdown content={question.questionText} className="text-sm" />
                  <div className="space-y-2">
                    {question.choices.map((choice) => {
                      const wasSelected = userIds.includes(choice.id);
                      const isChoiceCorrect = choice.correct;
                      return (
                        <div
                          key={choice.id}
                          className={cn(
                            "p-2 rounded-lg text-sm border",
                            isChoiceCorrect &&
                              "bg-green-50 dark:bg-green-950/30 border-green-200",
                            wasSelected &&
                              !isChoiceCorrect &&
                              "bg-red-50 dark:bg-red-950/30 border-red-200",
                            !wasSelected &&
                              !isChoiceCorrect &&
                              "opacity-60"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 mt-0.5">
                              {isChoiceCorrect
                                ? "\u2713"
                                : wasSelected
                                  ? "\u2717"
                                  : ""}
                            </span>
                            <div className="flex-1">
                              <MathMarkdown
                                content={choice.text}
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {choice.explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
