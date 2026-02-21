"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useAppStore, useHasAnyApiKey } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  lessonId: string;
  courseId: string;
  onClose: () => void;
  initialInput?: string;
}

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatPanel({ lessonId, courseId, onClose, initialInput }: ChatPanelProps) {
  const { t } = useTranslation(["chat", "common"]);
  const hasAnyApiKey = useHasAnyApiKey();
  const apiKeys = useAppStore((s) => s.apiKeys);
  const chatModel = useAppStore((s) => s.chatModel);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef(false);
  const userIsNearBottom = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [input, setInput] = useState(initialInput || "");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        headers: {
          "x-api-keys": JSON.stringify(apiKeys),
        },
        body: {
          lessonId,
          courseId,
          model: chatModel,
        },
      }),
    [apiKeys, lessonId, courseId, chatModel]
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

  // Track scroll position to determine if user is near bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container || programmaticScrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceFromBottom < 80;
      userIsNearBottom.current = nearBottom;
      setShowScrollButton(!nearBottom);
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to bottom on new messages — only when user is near bottom
  // During streaming, use instant scroll to avoid competing smooth animations (flicker).
  // Use smooth scroll only for discrete events (new message count, not mid-stream text updates).
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (!userIsNearBottom.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const isStreaming = status === "streaming";
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isStreaming) {
      // During streaming: instant scroll (no animation) to avoid flicker
      container.scrollTop = container.scrollHeight;
    } else if (messageCountChanged) {
      // New message added (not streaming): smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  // Handle initialInput from "Ask AI" buttons
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
    }
  }, [initialInput]);

  function scrollToBottom() {
    programmaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    userIsNearBottom.current = true;
    setShowScrollButton(false);
    setTimeout(() => { programmaticScrollRef.current = false; }, 1000);
  }

  // Persist user messages and submit
  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userText = input;
      setInput("");

      // Always scroll to bottom when user sends a message
      programmaticScrollRef.current = true;
      userIsNearBottom.current = true;
      setShowScrollButton(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => { programmaticScrollRef.current = false; }, 1000);
      }, 50);

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
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 relative"
        data-testid="chat-messages-container"
      >
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

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="relative shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full shadow-md h-8 w-8 p-0 z-10"
            onClick={scrollToBottom}
            title={t("scrollToLatest")}
            data-testid="scroll-to-bottom"
          >
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
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </Button>
        </div>
      )}

      {/* Input */}
      {!hasAnyApiKey && chatModel !== "mock" ? (
        <div className="border-t px-3 py-3">
          <p className="text-xs text-muted-foreground text-center">
            {t("common:apiKeyRequiredHint")}
          </p>
        </div>
      ) : (
        <ChatInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSubmit={handleChatSubmit}
          isLoading={isLoading}
          onVoiceText={(text) => setInput((prev) => prev + (prev ? " " : "") + text)}
        />
      )}
    </div>
  );
}
