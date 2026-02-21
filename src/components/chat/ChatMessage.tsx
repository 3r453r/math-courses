"use client";

import { memo } from "react";
import { MathMarkdown } from "@/components/lesson/MathMarkdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

function ChatMessageInner({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <MathMarkdown content={content} className="[&_p]:my-1" />
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageInner);
