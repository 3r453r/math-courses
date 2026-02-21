"use client";

import katex from "katex";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { t } = useTranslation("lessonContent");
  const [copied, setCopied] = useState(false);

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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      toast.success(t("copiedLatex"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

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

  // KaTeX output with trust:false is safe — only KaTeX-generated markup.
  // This is NOT user/AI content — it's the output of katex.renderToString
  // which produces only KaTeX's own HTML structure (spans with CSS classes).
  return (
    <div className={cn("my-4 overflow-x-auto text-center relative group", className)}>
      <div dangerouslySetInnerHTML={{ __html: html! }} />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground"
              data-testid="copy-latex-button"
              aria-label="Copy LaTeX"
            >
              {copied ? (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Copy LaTeX</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
