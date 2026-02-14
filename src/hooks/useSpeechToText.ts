"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { SpeechManager } from "@/lib/speech/speechManager";
import { getSpeechLang } from "@/lib/speech/languageMap";
import { processTranscript } from "@/lib/speech/voiceKeywords";

interface UseSpeechToTextOptions {
  onResult: (processedText: string) => void;
}

export function useSpeechToText({ onResult }: UseSpeechToTextOptions) {
  const language = useAppStore((s) => s.language);
  const customVoiceKeywords = useAppStore((s) => s.customVoiceKeywords);
  const managerRef = useRef<SpeechManager | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Store onResult in a ref to avoid re-creating the manager on every render
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const langRef = useRef(language);
  langRef.current = language;

  const customKwRef = useRef(customVoiceKeywords);
  customKwRef.current = customVoiceKeywords;

  useEffect(() => {
    setIsSupported(SpeechManager.isSupported());
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const speechLang = getSpeechLang(language);
    const manager = new SpeechManager(speechLang);

    manager.onResult = (text: string) => {
      const custom = customKwRef.current.length > 0 ? customKwRef.current : undefined;
      const processed = processTranscript(text, langRef.current, custom);
      setInterimTranscript("");
      onResultRef.current(processed);
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
      }
    };

    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [isSupported, language]);

  const toggleListening = useCallback(() => {
    setError(null);
    managerRef.current?.toggle();
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    toggleListening,
  };
}
