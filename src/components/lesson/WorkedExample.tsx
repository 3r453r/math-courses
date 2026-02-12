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
import { Separator } from "@/components/ui/separator";
import { MathMarkdown } from "./MathMarkdown";
import { KaTeXBlock } from "./KaTeXBlock";
import type { WorkedExample as WorkedExampleType } from "@/types/lesson";

interface Props {
  example: WorkedExampleType;
  index: number;
}

export function WorkedExample({ example, index }: Props) {
  const [expandedSteps, setExpandedSteps] = useState(0);
  const allExpanded = expandedSteps >= example.steps.length;

  return (
    <Card className="my-6 border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-300"
          >
            Example {index + 1}
          </Badge>
          <CardTitle className="text-lg">{example.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Problem
          </p>
          <MathMarkdown content={example.problemStatement} />
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Solution Steps
          </p>
          <div className="space-y-3">
            {example.steps.slice(0, expandedSteps).map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <MathMarkdown
                    content={step.description}
                    className="text-sm"
                  />
                  {step.math && <KaTeXBlock latex={step.math} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {!allExpanded && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedSteps((prev) => prev + 1)}
              >
                Show Next Step ({expandedSteps}/{example.steps.length})
              </Button>
            )}
            {expandedSteps > 0 && !allExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedSteps(example.steps.length)}
              >
                Show All Steps
              </Button>
            )}
          </div>
        </div>

        {allExpanded && (
          <>
            <Separator />
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                Final Answer
              </p>
              <MathMarkdown content={example.finalAnswer} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
