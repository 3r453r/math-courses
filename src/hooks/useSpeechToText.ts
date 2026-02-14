"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { SpeechManager } from "@/lib/speech/speechManager";
import { getSpeechLang } from "@/lib/speech/languageMap";
import { processTranscriptWithCursor } from "@/lib/speech/voiceKeywords";
import type { VoiceConfig } from "@/lib/speech/voiceKeywords";

export interface EditorContext {
  inMathMode: boolean;
  surroundingText: string;
}

interface UseSpeechToTextOptions {
  onResult: (processedText: string, cursorOffset?: number) => void;
  onRawTranscript?: (rawText: string) => void;
  getEditorContext?: () => EditorContext;
  /** Skip keyword/AI processing — just pass raw transcript through */
  rawMode?: boolean;
}

const AI_DEBOUNCE_MS = 800;

export function useSpeechToText({ onResult, onRawTranscript, getEditorContext, rawMode }: UseSpeechToTextOptions) {
  const language = useAppStore((s) => s.language);
  const customVoiceKeywords = useAppStore((s) => s.customVoiceKeywords);
  const voiceKeywordOverrides = useAppStore((s) => s.voiceKeywordOverrides);
  const controlKeywordOverrides = useAppStore((s) => s.controlKeywordOverrides);
  const voiceAiMode = useAppStore((s) => s.voiceAiMode);
  const voiceTriggerEnabled = useAppStore((s) => s.voiceTriggerEnabled);
  const voiceTriggerWord = useAppStore((s) => s.voiceTriggerWord);
  const apiKey = useAppStore((s) => s.apiKey);
  const chatModel = useAppStore((s) => s.chatModel);
  const managerRef = useRef<SpeechManager | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for stable callback access
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onRawTranscriptRef = useRef(onRawTranscript);
  onRawTranscriptRef.current = onRawTranscript;

  const getEditorContextRef = useRef(getEditorContext);
  getEditorContextRef.current = getEditorContext;

  const langRef = useRef(language);
  langRef.current = language;

  const customKwRef = useRef(customVoiceKeywords);
  customKwRef.current = customVoiceKeywords;

  const overridesRef = useRef(voiceKeywordOverrides);
  overridesRef.current = voiceKeywordOverrides;

  const controlOverridesRef = useRef(controlKeywordOverrides);
  controlOverridesRef.current = controlKeywordOverrides;

  const voiceAiModeRef = useRef(voiceAiMode);
  voiceAiModeRef.current = voiceAiMode;

  const voiceTriggerEnabledRef = useRef(voiceTriggerEnabled);
  voiceTriggerEnabledRef.current = voiceTriggerEnabled;

  const voiceTriggerWordRef = useRef(voiceTriggerWord);
  voiceTriggerWordRef.current = voiceTriggerWord;

  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  const chatModelRef = useRef(chatModel);
  chatModelRef.current = chatModel;

  const rawModeRef = useRef(rawMode);
  rawModeRef.current = rawMode;

  // AI debounce buffer
  const aiBufferRef = useRef<string[]>([]);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSupported(SpeechManager.isSupported());
  }, []);

  const flushAiBuffer = useCallback(async () => {
    const buffer = aiBufferRef.current;
    if (buffer.length === 0) return;
    aiBufferRef.current = [];

    const transcript = buffer.join(" ");
    const key = apiKeyRef.current;
    if (!key) {
      // Fall back to keyword mode if no API key
      const config = buildVoiceConfig();
      const { text, cursorOffset } = processTranscriptWithCursor(transcript, langRef.current, config);
      onResultRef.current(text, cursorOffset);
      return;
    }

    setIsProcessing(true);
    try {
      const editorCtx = getEditorContextRef.current?.() ?? { inMathMode: false, surroundingText: "" };
      const res = await fetch("/api/voice/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify({
          transcript,
          context: {
            inMathMode: editorCtx.inMathMode,
            surroundingText: editorCtx.surroundingText,
            language: langRef.current,
          },
          model: chatModelRef.current,
        }),
      });

      if (!res.ok) {
        // Fall back to keyword mode on error
        const config = buildVoiceConfig();
        const { text, cursorOffset } = processTranscriptWithCursor(transcript, langRef.current, config);
        onResultRef.current(text, cursorOffset);
        return;
      }

      const data = await res.json();
      onResultRef.current(data.result ?? transcript, 0);
    } catch {
      // Fall back to keyword mode on network error
      const config = buildVoiceConfig();
      const { text, cursorOffset } = processTranscriptWithCursor(transcript, langRef.current, config);
      onResultRef.current(text, cursorOffset);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  function buildVoiceConfig(): VoiceConfig | undefined {
    const config: VoiceConfig = {
      customKeywords: customKwRef.current.length > 0 ? customKwRef.current : undefined,
      overrides: Object.keys(overridesRef.current).length > 0 ? overridesRef.current : undefined,
      controlOverrides: Object.keys(controlOverridesRef.current).length > 0 ? controlOverridesRef.current : undefined,
      triggerEnabled: voiceTriggerEnabledRef.current || undefined,
      triggerWord: voiceTriggerWordRef.current || undefined,
    };
    const hasConfig = config.customKeywords || config.overrides || config.controlOverrides || config.triggerEnabled;
    return hasConfig ? config : undefined;
  }

  useEffect(() => {
    if (!isSupported) return;

    const speechLang = getSpeechLang(language);
    const manager = new SpeechManager(speechLang);

    manager.onResult = (text: string) => {
      setInterimTranscript("");

      // Always emit raw transcript if callback provided
      onRawTranscriptRef.current?.(text);

      // Raw mode: pass through unprocessed
      if (rawModeRef.current) {
        onResultRef.current(text, 0);
        return;
      }

      if (voiceAiModeRef.current) {
        // AI mode: buffer and debounce
        aiBufferRef.current.push(text);
        if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        aiTimerRef.current = setTimeout(() => {
          flushAiBuffer();
        }, AI_DEBOUNCE_MS);
      } else {
        // Keyword mode: process synchronously with cursor offset
        const config = buildVoiceConfig();
        const { text: processed, cursorOffset } = processTranscriptWithCursor(text, langRef.current, config);
        onResultRef.current(processed, cursorOffset);
      }
    };

    manager.onInterim = (text: string) => {
      setInterimTranscript(text);
    };

    manager.onError = (msg: string) => {
      setError(msg);
    };

    manager.onListeningChange = (listening: boolean) => {
      setIsListening(listening);
      if (!listening) {
        setInterimTranscript("");
        // Flush AI buffer when listening stops
        if (aiTimerRef.current) {
          clearTimeout(aiTimerRef.current);
          aiTimerRef.current = null;
        }
        if (aiBufferRef.current.length > 0) {
          flushAiBuffer();
        }
      }
    };

    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
      if (aiTimerRef.current) {
        clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [isSupported, language, flushAiBuffer]);

  const toggleListening = useCallback(() => {
    setError(null);
    managerRef.current?.toggle();
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    isProcessing,
    toggleListening,
  };
}
