"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCommandsByCategory } from "@/lib/scratchpad/slashCommands";
import { SymbolPicker } from "./SymbolPicker";
import { VoiceKeywordConfig } from "./VoiceKeywordConfig";
import { VoiceCalibrationPanel } from "./VoiceCalibrationPanel";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import type { EditorContext } from "@/hooks/useSpeechToText";
import { useAppStore } from "@/stores/appStore";

type PanelMode = "none" | "help" | "symbols" | "voice" | "calibrate";

interface ScratchpadToolbarProps {
  onInsertSymbol: (text: string, cursorOffset: number) => void;
  getEditorContext?: () => EditorContext;
}

export function ScratchpadToolbar({ onInsertSymbol, getEditorContext }: ScratchpadToolbarProps) {
  const { t } = useTranslation("scratchpad");
  const [panel, setPanel] = useState<PanelMode>("none");
  const grouped = getCommandsByCategory();
  const voiceAiMode = useAppStore((s) => s.voiceAiMode);
  const setVoiceAiMode = useAppStore((s) => s.setVoiceAiMode);

  const { isSupported, isListening, interimTranscript, error, isProcessing, toggleListening } =
    useSpeechToText({
      onResult: (processed: string, cursorOffset?: number) => {
        if (processed.length > 0) {
          const prefix = processed.startsWith("\n") ? "" : " ";
          onInsertSymbol(prefix + processed, cursorOffset ?? 0);
        }
      },
      getEditorContext,
    });

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const categoryLabel = (key: string) => {
    const labels: Record<string, string> = {
      formatting: t("formatting"),
      operators: t("operators"),
      greek: t("greekLetters"),
      symbols: t("symbols"),
      delimiters: t("delimiters"),
    };
    return labels[key] ?? key;
  };

  const togglePanel = (mode: PanelMode) => {
    setPanel((prev) => (prev === mode ? "none" : mode));
  };

  const statusText = useCallback(() => {
    if (isProcessing) return t("interpreting");
    if (interimTranscript) return interimTranscript;
    return t("listening");
  }, [isProcessing, interimTranscript, t]);

  return (
    <div className="border-t bg-muted/30">
      {/* Symbol Picker Panel */}
      {panel === "symbols" && (
        <SymbolPicker onInsert={onInsertSymbol} />
      )}

      {/* Voice Keyword Config Panel */}
      {panel === "voice" && <VoiceKeywordConfig />}

      {/* Voice Calibration Panel */}
      {panel === "calibrate" && <VoiceCalibrationPanel />}

      {/* Help Panel */}
      {panel === "help" && (
        <div className="border-t px-3 py-3 max-h-72 overflow-y-auto text-xs space-y-4">
          {/* Quick Start */}
          <div>
            <p className="font-medium text-foreground mb-1.5">{t("quickStart")}</p>
            <div className="text-muted-foreground space-y-1">
              <p>Write notes using <strong>Markdown</strong> with LaTeX math support.</p>
              <p>
                <kbd className="bg-muted px-1 rounded font-mono">$x^2 + y^2$</kbd> for inline math:{" "}
                wrap LaTeX in single dollar signs.
              </p>
              <p>
                <kbd className="bg-muted px-1 rounded font-mono">$$\sum_&#123;i=1&#125;^n x_i$$</kbd> for display math:{" "}
                wrap in double dollar signs.
              </p>
              <p>
                Type <kbd className="bg-muted px-1 rounded font-mono">/command</kbd> then{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Space</kbd> or{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Tab</kbd> to expand LaTeX shortcuts.
                A popup will show matching commands as you type.
              </p>
              <p>Notes autosave after 30 seconds of inactivity, or press{" "}
                <kbd className="bg-muted px-1 rounded font-mono">Ctrl+S</kbd> to save immediately.
              </p>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <p className="font-medium text-foreground mb-1.5">{t("keyboardShortcuts")}</p>
            <div className="text-muted-foreground space-y-0.5">
              <p><kbd className="bg-muted px-1 rounded font-mono">Ctrl+S</kbd> {t("saveNow")}</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Tab</kbd> {t("expandCommand")}</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Space</kbd> {t("expandAfterCmd")}</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Enter</kbd> {t("selectFromPopup")}</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">Esc</kbd> {t("closePopup")}</p>
              <p><kbd className="bg-muted px-1 rounded font-mono">&uarr; &darr;</kbd> {t("navigatePopup")}</p>
            </div>
          </div>

          {/* Voice Dictation */}
          <div>
            <p className="font-medium text-foreground mb-1.5">{t("voiceDictationHelp")}</p>
            <div className="text-muted-foreground space-y-1">
              <p>{t("voiceDictationDesc")}</p>
              <p>{t("voiceDictationKeywords")}</p>
              <p>{t("voiceDictationMultiInput")}</p>
              <p>{t("voiceDictationMathOnly")}</p>
              <p>{t("voiceDictationCustom")}</p>
            </div>
          </div>

          {/* Slash Commands */}
          <div>
            <p className="font-medium text-foreground mb-1.5">{t("slashCommands")}</p>
            {Object.entries(grouped).map(([category, commands]) => (
              <div key={category} className="mb-2 last:mb-0">
                <p className="text-muted-foreground/70 mb-1">
                  {categoryLabel(category)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {commands.map((cmd) => (
                    <Badge
                      key={cmd.trigger}
                      variant="outline"
                      className="font-mono text-[10px] cursor-default py-0"
                      title={`/${cmd.trigger} → ${cmd.expansion}`}
                    >
                      /{cmd.trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Button bar */}
      <div className="flex items-center justify-between px-3 py-1.5">
        {isListening || isProcessing ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {isProcessing ? (
              <span className="animate-spin inline-block">&#9696;</span>
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {statusText()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t("typeForCommands") }} />
        )}
        <div className="flex items-center gap-1">
          {isSupported && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isListening ? "destructive" : "ghost"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={toggleListening}
                    >
                      {isListening ? t("stopDictation") : t("dictateButton")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isListening ? t("stopDictation") : t("startDictation")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={voiceAiMode ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setVoiceAiMode(!voiceAiMode)}
                    >
                      {t("aiModeButton")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("aiModeTooltip")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant={panel === "calibrate" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => togglePanel("calibrate")}
              >
                {t("calibrateButton")}
              </Button>
              <Button
                variant={panel === "voice" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => togglePanel("voice")}
              >
                {t("voiceConfigButton")}
              </Button>
            </>
          )}
          <Button
            variant={panel === "symbols" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => togglePanel("symbols")}
          >
            {t("symbolsButton")}
          </Button>
          <Button
            variant={panel === "help" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => togglePanel("help")}
          >
            {t("helpButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
