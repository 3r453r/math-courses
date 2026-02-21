"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { MessageCircleQuestion } from "lucide-react";
import type { TheoremSection } from "@/types/lesson";

interface Props {
  section: TheoremSection;
  onChatAbout?: (context: string) => void;
}

export function TheoremSectionRenderer({ section, onChatAbout }: Props) {
  const { t } = useTranslation("lessonContent");
  const [showProof, setShowProof] = useState(false);

  return (
    <Card className="my-6 border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Theorem</Badge>
          <CardTitle className="text-lg">{section.name}</CardTitle>
          {onChatAbout && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs text-muted-foreground gap-1"
              onClick={() =>
                onChatAbout(
                  `I have a question about this theorem:\n\n**${section.name}**: ${section.statement}`
                )
              }
              data-testid="ask-ai-button"
            >
              <MessageCircleQuestion className="size-3.5" />
              {t("askAi")}
            </Button>
          )}
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
