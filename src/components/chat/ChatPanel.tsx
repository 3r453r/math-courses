"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  lessonId: string;
  courseId: string;
  onClose: () => void;
}

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatPanel({ lessonId, courseId, onClose }: ChatPanelProps) {
  const { t } = useTranslation("chat");
  const apiKey = useAppStore((s) => s.apiKey);
  const chatModel = useAppStore((s) => s.chatModel);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef(false);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        headers: {
          "x-api-key": apiKey || "",
        },
        body: {
          lessonId,
          courseId,
          model: chatModel,
        },
      }),
    [apiKey, lessonId, courseId, chatModel]
  );

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport,
    onFinish: async ({ message }) => {
      // Persist the assistant message
      const text = getTextFromMessage(message);
      if (text) {
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            role: message.role,
            content: text,
          }),
        });
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Load existing messages on mount
  useEffect(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    async function loadHistory() {
      try {
        const res = await fetch(
          `/api/chat/messages?lessonId=${encodeURIComponent(lessonId)}`
        );
        if (res.ok) {
          const history = await res.json();
          if (history.length > 0) {
            setMessages(
              history.map(
                (m: { id: string; role: string; content: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  parts: [{ type: "text" as const, text: m.content }],
                })
              )
            );
          }
        }
      } catch {
        // Silently fail - user can still chat without history
      }
    }
    loadHistory();
  }, [lessonId, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist user messages and submit
  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userText = input;
      setInput("");

      // Save user message to DB
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          role: "user",
          content: userText,
        }),
      });

      sendMessage({ text: userText });
    },
    [input, lessonId, sendMessage, isLoading]
  );

  async function handleClearHistory() {
    try {
      await fetch(
        `/api/chat/messages?lessonId=${encodeURIComponent(lessonId)}`,
        { method: "DELETE" }
      );
      setMessages([]);
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="w-full border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{t("aiTutor")}</h3>
          {isLoading && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="animate-spin inline-block">&#9696;</span>
              {t("thinking")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={handleClearHistory}
            >
              {t("clear")}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClose}>
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <p className="font-medium">{t("emptyPrompt")}</p>
            <p className="text-xs mt-1">
              {t("emptyDescription")}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role as "user" | "assistant"}
            content={getTextFromMessage(message)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onSubmit={handleChatSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
