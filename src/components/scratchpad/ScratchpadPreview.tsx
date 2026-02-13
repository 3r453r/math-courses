"use client";

import { MathMarkdown } from "@/components/lesson/MathMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScratchpadPreviewProps {
  content: string;
  className?: string;
}

export function ScratchpadPreview({
  content,
  className,
}: ScratchpadPreviewProps) {
  if (!content.trim()) {
    return (
      <div
        className={`flex items-center justify-center h-full text-muted-foreground text-sm ${className ?? ""}`}
      >
        Preview will appear here as you type...
      </div>
    );
  }

  return (
    <ScrollArea className={`h-full ${className ?? ""}`}>
      <div className="p-4">
        <MathMarkdown content={content} />
      </div>
    </ScrollArea>
  );
}
