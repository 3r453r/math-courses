"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getDefaultSimpleKeywords,
  getDefaultMultiInputKeywords,
  getControlKeywordPhrases,
} from "@/lib/speech/voiceKeywords";

export function VoiceKeywordConfig() {
  const { t } = useTranslation("scratchpad");
  const language = useAppStore((s) => s.language);
  const customKeywords = useAppStore((s) => s.customVoiceKeywords);
  const addCustom = useAppStore((s) => s.addCustomVoiceKeyword);
  const removeCustom = useAppStore((s) => s.removeCustomVoiceKeyword);

  const [newPhrase, setNewPhrase] = useState("");
  const [newReplacement, setNewReplacement] = useState("");

  const defaultKeywords = getDefaultSimpleKeywords(language);
  const multiInputKeywords = getDefaultMultiInputKeywords(language);
  const controls = getControlKeywordPhrases(language);

  const categories = new Map<string, { phrase: string; replacement: string }[]>();
  for (const kw of defaultKeywords) {
    const list = categories.get(kw.category) ?? [];
    list.push({ phrase: kw.phrase, replacement: kw.replacement });
    categories.set(kw.category, list);
  }

  const categoryLabel = (key: string) => {
    const labels: Record<string, string> = {
      structure: t("delimiters"),
      operator: t("operators"),
      greek: t("greekLetters"),
      formatting: t("formatting"),
      latex: t("symbols"),
    };
    return labels[key] ?? key;
  };

  const handleAdd = () => {
    const phrase = newPhrase.trim();
    const replacement = newReplacement.trim();
    if (!phrase || !replacement) return;
    addCustom({ phrase, replacement });
    setNewPhrase("");
    setNewReplacement("");
  };

  return (
    <div className="border-t px-3 py-3 max-h-72 overflow-y-auto text-xs space-y-3">
      {/* Multi-input instructions */}
      <div>
        <p className="font-medium text-foreground mb-1">{t("voiceMultiInput")}</p>
        <p className="text-muted-foreground text-[11px]">
          {t("voiceMultiInputHelp", {
            nextInput: controls.nextInput,
            endInput: controls.endInput,
          })}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {multiInputKeywords.map((mk) => (
            <Badge
              key={mk.phrase}
              variant="outline"
              className="font-mono text-[10px] cursor-default py-0"
              title={`"${mk.phrase} ... ${controls.nextInput} ... ${controls.endInput}" → ${mk.template}`}
            >
              {mk.phrase} → {mk.template}
            </Badge>
          ))}
        </div>
      </div>

      {/* Default keywords by category */}
      {Array.from(categories.entries()).map(([category, keywords]) => (
        <div key={category}>
          <p className="text-muted-foreground/70 mb-1">{categoryLabel(category)}</p>
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => (
              <Badge
                key={kw.phrase}
                variant="outline"
                className="font-mono text-[10px] cursor-default py-0"
                title={`"${kw.phrase}" → ${kw.replacement}`}
              >
                {kw.phrase} → {kw.replacement.replace(/\n/g, "↵")}
              </Badge>
            ))}
          </div>
        </div>
      ))}

      {/* Custom keywords */}
      <div>
        <p className="font-medium text-foreground mb-1">{t("customCommands")}</p>
        {customKeywords.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {customKeywords.map((ck) => (
              <Badge
                key={ck.phrase}
                variant="secondary"
                className="font-mono text-[10px] py-0 gap-1"
              >
                {ck.phrase} → {ck.replacement.replace(/\n/g, "↵")}
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={() => removeCustom(ck.phrase)}
                  title={t("removeCustom")}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-[11px] mb-2">{t("noCustomCommands")}</p>
        )}

        {/* Add form */}
        <div className="flex gap-1.5 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">{t("phraseLabel")}</label>
            <Input
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              placeholder={t("phrasePlaceholder")}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">{t("replacementLabel")}</label>
            <Input
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              placeholder={t("replacementPlaceholder")}
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleAdd}
            disabled={!newPhrase.trim() || !newReplacement.trim()}
          >
            {t("addCustom")}
          </Button>
        </div>
      </div>
    </div>
  );
}
