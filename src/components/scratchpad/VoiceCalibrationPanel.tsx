"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";

interface CalibrationEntry {
  id: number;
  raw: string;
  processed: string;
}

export function VoiceCalibrationPanel() {
  const { t } = useTranslation("scratchpad");
  const [entries, setEntries] = useState<CalibrationEntry[]>([]);
  const nextIdRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleResult = useCallback((processed: string) => {
    // Result processed through keywords/AI — we'll pair it with the raw transcript
    setEntries((prev) => {
      const updated = [...prev];
      // Find the last entry that doesn't have a processed result yet
      const lastUnprocessed = updated.findLastIndex((e) => e.processed === "");
      if (lastUnprocessed >= 0) {
        updated[lastUnprocessed] = { ...updated[lastUnprocessed], processed };
      }
      // Keep only last 10
      return updated.slice(-10);
    });
  }, []);

  const handleRaw = useCallback((raw: string) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const updated = [...prev, { id, raw, processed: "" }];
      return updated.slice(-10);
    });
  }, []);

  const { isSupported, isListening, isProcessing, interimTranscript, toggleListening } =
    useSpeechToText({
      onResult: handleResult,
      onRawTranscript: handleRaw,
    });

  // Auto-scroll when new entries arrive
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <div className="border-t px-3 py-3 max-h-72 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-foreground">{t("calibrationTitle")}</p>
        <div className="flex items-center gap-1">
          {isSupported && (
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={toggleListening}
            >
              {isListening ? t("stopDictation") : t("testSpeech")}
            </Button>
          )}
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setEntries([])}
            >
              {t("clearCalibration")}
            </Button>
          )}
        </div>
      </div>

      {/* Status indicator */}
      {(isListening || isProcessing) && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
          {isProcessing ? (
            <span className="animate-spin inline-block">&#9696;</span>
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
          {isProcessing ? t("interpreting") : interimTranscript || t("listening")}
        </div>
      )}

      {/* Results table */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("testSpeech")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {/* Header */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("rawTranscript")}</span>
              <span>{t("processedResult")}</span>
            </div>
            {/* Entries */}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-2 gap-2 text-xs border rounded px-2 py-1.5"
              >
                <span className="text-muted-foreground break-words">{entry.raw}</span>
                <span className="text-foreground break-words font-mono">
                  {entry.processed || (
                    <span className="text-muted-foreground/50 italic">
                      {isProcessing ? t("interpreting") : "..."}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
