"use client";

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
import type { DefinitionSection } from "@/types/lesson";

interface Props {
  section: DefinitionSection;
  onChatAbout?: (context: string) => void;
}

export function DefinitionSectionRenderer({ section, onChatAbout }: Props) {
  const { t } = useTranslation("lessonContent");

  return (
    <Card className="my-6 border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Definition</Badge>
          <CardTitle className="text-lg">{section.term}</CardTitle>
          {onChatAbout && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs text-muted-foreground gap-1"
              onClick={() =>
                onChatAbout(
                  `I'd like to understand this definition better:\n\n**${section.term}**: ${section.definition}`
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
        <MathMarkdown content={section.definition} />
        {section.intuition && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Intuition
            </p>
            <MathMarkdown content={section.intuition} className="text-sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
