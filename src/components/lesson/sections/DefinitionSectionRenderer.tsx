"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { DefinitionSection } from "@/types/lesson";

interface Props {
  section: DefinitionSection;
}

export function DefinitionSectionRenderer({ section }: Props) {
  return (
    <Card className="my-6 border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Definition</Badge>
          <CardTitle className="text-lg">{section.term}</CardTitle>
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
