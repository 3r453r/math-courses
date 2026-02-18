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
  const { html, error } = useMemo(() => {
    try {
      return {
        html: katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          trust: false,
        }),
        error: null,
      };
    } catch {
      return { html: null, error: latex };
    }
  }, [latex, displayMode]);

  // Error path uses React text rendering (safe) — never dangerouslySetInnerHTML
  // with unsanitized user/AI content to prevent XSS.
  if (error !== null) {
    return (
      <div className={cn("my-4 overflow-x-auto text-center", className)}>
        <span className="text-destructive">
          Invalid LaTeX: {error}
        </span>
      </div>
    );
  }

  // KaTeX output with trust:false is safe — only KaTeX-generated markup
  return (
    <div
      className={cn("my-4 overflow-x-auto text-center", className)}
      dangerouslySetInnerHTML={{ __html: html! }}
    />
  );
}
