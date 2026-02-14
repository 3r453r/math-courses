"use client";

import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { CodeBlockSection } from "@/types/lesson";

interface Props {
  section: CodeBlockSection;
}

export function CodeBlockSectionRenderer({ section }: Props) {
  return (
    <div className="my-4">
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono border-b">
          {section.language}
        </div>
        <pre className="p-4 overflow-x-auto bg-muted/30">
          <code className="text-sm font-mono whitespace-pre">{section.code}</code>
        </pre>
      </div>
      {section.explanation && (
        <div className="mt-2 text-sm text-muted-foreground">
          <MathMarkdown content={section.explanation} />
        </div>
      )}
    </div>
  );
}
