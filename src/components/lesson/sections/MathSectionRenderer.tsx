"use client";

import { KaTeXBlock } from "@/components/lesson/KaTeXBlock";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { MathSection } from "@/types/lesson";

interface Props {
  section: MathSection;
}

export function MathSectionRenderer({ section }: Props) {
  return (
    <div className="my-6">
      <KaTeXBlock latex={section.latex} />
      {section.explanation && (
        <MathMarkdown
          content={section.explanation}
          className="mt-2 text-sm text-muted-foreground"
        />
      )}
    </div>
  );
}
