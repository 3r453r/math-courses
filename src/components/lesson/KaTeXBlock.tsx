"use client";

import katex from "katex";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface KaTeXBlockProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export function KaTeXBlock({
  latex,
  displayMode = true,
  className,
}: KaTeXBlockProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        trust: false,
      });
    } catch {
      return `<span class="text-destructive">Invalid LaTeX: ${latex}</span>`;
    }
  }, [latex, displayMode]);

  return (
    <div
      className={cn("my-4 overflow-x-auto text-center", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
