"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Rehype plugin (runs AFTER rehype-katex): extracts the raw LaTeX from
// KaTeX's <annotation encoding="application/x-tex"> and stores it as a
// data-math-latex attribute on the wrapping .katex-display / .katex span.
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function rehypeKatexCopyable() {
  return (tree: any) => {
    walkWithParent(tree, null, (node: any, parent: any) => {
      if (node.type !== "element") return;
      const cls = node.properties?.className;
      if (!Array.isArray(cls)) return;

      if (cls.includes("katex-display")) {
        // Display math — tag the katex-display wrapper
        const latex = findAnnotationText(node);
        if (latex) node.properties.dataMathLatex = latex;
      } else if (cls.includes("katex")) {
        // Inline math — only tag if NOT inside a katex-display parent
        const parentCls = parent?.properties?.className;
        if (Array.isArray(parentCls) && parentCls.includes("katex-display")) return;
        const latex = findAnnotationText(node);
        if (latex) node.properties.dataMathLatex = latex;
      }
    });
  };
}

function walkWithParent(node: any, parent: any, fn: (n: any, p: any) => void) {
  fn(node, parent);
  if (node.children) {
    for (const child of node.children) walkWithParent(child, node, fn);
  }
}

function findAnnotationText(node: any): string | null {
  if (
    node.type === "element" &&
    node.tagName === "annotation" &&
    node.properties?.encoding === "application/x-tex"
  ) {
    return textContent(node);
  }
  if (node.children) {
    for (const child of node.children) {
      const result = findAnnotationText(child);
      if (result) return result;
    }
  }
  return null;
}

function textContent(node: any): string {
  if (node.type === "text") return node.value || "";
  if (node.children) return node.children.map(textContent).join("");
  return "";
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Copy button shown on hover for display math (same style as KaTeXBlock)
// ---------------------------------------------------------------------------
function CopyLatexButton({ latex }: { latex: string }) {
  const { t } = useTranslation("lessonContent");
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      toast.success(t("copiedLatex"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground"
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
  );
}

// ---------------------------------------------------------------------------
// Component overrides for ReactMarkdown — intercept KaTeX-rendered spans
// ---------------------------------------------------------------------------

/** Display math (katex-display) → relative wrapper + hover copy button */
/** Inline math (katex, not in display) → click to copy */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MathSpanWrapper(props: any) {
  const { t } = useTranslation("lessonContent");
  // React passes data-* attributes as-is (HTML form), not camelCase
  const latex: string | undefined = props["data-math-latex"];
  const { children, className, node, "data-math-latex": _dml, ...rest } = props;

  // Display math: katex-display span with copy button on hover
  if (latex && typeof className === "string" && className.includes("katex-display")) {
    return (
      <span className={cn(className, "relative group !block")} {...rest}>
        {children}
        <CopyLatexButton latex={latex} />
      </span>
    );
  }

  // Inline math: katex span with click-to-copy
  if (latex && typeof className === "string" && className.includes("katex")) {
    return (
      <span
        className={cn(className, "cursor-pointer")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(latex);
            toast.success(t("copiedLatex"));
          } catch {
            // Clipboard API not available
          }
        }}
        title="Click to copy LaTeX"
        {...rest}
      >
        {children}
      </span>
    );
  }

  return <span className={className} {...rest}>{children}</span>;
}

// Stable reference — defined once at module level to avoid re-mounting on every render
const markdownComponents = {
  span: MathSpanWrapper,
};

const rehypePlugins = [rehypeKatex, rehypeKatexCopyable];

// ---------------------------------------------------------------------------
// MathMarkdown
// ---------------------------------------------------------------------------
interface MathMarkdownProps {
  content: string;
  className?: string;
}

export function MathMarkdown({ content, className }: MathMarkdownProps) {
  return (
    <div
      className={cn(
        "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2",
        "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
        "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1",
        "[&_p]:my-3 [&_p]:leading-relaxed",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
        "[&_li]:my-1",
        "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm",
        "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3",
        "[&_strong]:font-semibold",
        "[&_a]:text-primary [&_a]:underline",
        "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
        "[&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
        "[&_tr:nth-child(even)]:bg-muted/30",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
