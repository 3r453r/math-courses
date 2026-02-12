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
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { TheoremSection } from "@/types/lesson";

interface Props {
  section: TheoremSection;
}

export function TheoremSectionRenderer({ section }: Props) {
  const [showProof, setShowProof] = useState(false);

  return (
    <Card className="my-6 border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Theorem</Badge>
          <CardTitle className="text-lg">{section.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <MathMarkdown content={section.statement} />
        {section.intuition && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Intuition
            </p>
            <MathMarkdown content={section.intuition} className="text-sm" />
          </div>
        )}
        {section.proof && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProof(!showProof)}
            >
              {showProof ? "Hide Proof" : "Show Proof"}
            </Button>
            {showProof && (
              <div className="mt-2 border-l-2 border-muted pl-4">
                <MathMarkdown content={section.proof} className="text-sm" />
                <p className="text-right text-muted-foreground text-sm mt-2">
                  &#8718;
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
