"use client";

import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import type { TextSection } from "@/types/lesson";

interface Props {
  section: TextSection;
}

export function TextSectionRenderer({ section }: Props) {
  return <MathMarkdown content={section.content} />;
}
