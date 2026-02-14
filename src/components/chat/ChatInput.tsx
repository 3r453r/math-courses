"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSpeechToText } from "@/hooks/useSpeechToText";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onVoiceText?: (text: string) => void;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, onVoiceText }: ChatInputProps) {
  const { t } = useTranslation("chat");

  const { isSupported, isListening, error, toggleListening } = useSpeechToText({
    onResult: (text: string) => {
      onVoiceText?.(text);
    },
    rawMode: true,
  });

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

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
          placeholder={t("placeholder")}
          rows={1}
          className="min-h-[36px] max-h-[120px] resize-none text-sm"
        />
        {isSupported && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="sm"
                  className="shrink-0 px-2"
                  onClick={toggleListening}
                >
                  {isListening ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </span>
                  ) : (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isListening ? t("stopDictation") : t("dictateTooltip")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button type="submit" size="sm" disabled={isLoading || !value.trim()}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
