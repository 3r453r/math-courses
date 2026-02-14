"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading }: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t p-3 shrink-0">
      <div className="flex gap-2">
        <Textarea
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          className="min-h-[36px] max-h-[120px] resize-none text-sm"
        />
        <Button type="submit" size="sm" disabled={isLoading || !value.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
}
