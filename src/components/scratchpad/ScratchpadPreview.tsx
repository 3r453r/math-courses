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
        className={`flex items-center justify-center flex-1 min-h-0 text-muted-foreground text-sm ${className ?? ""}`}
      >
        Preview will appear here as you type...
      </div>
    );
  }

  return (
    <ScrollArea className={`flex-1 min-h-0 ${className ?? ""}`}>
      <div className="p-4">
        <MathMarkdown content={content} />
      </div>
    </ScrollArea>
  );
}
