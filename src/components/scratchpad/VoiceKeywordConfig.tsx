"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, X } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  resolveSimpleKeywords,
  resolveMultiInputKeywords,
  resolveControlKeywords,
  getControlKeywordPhrases,
  getEffectiveLang,
  getDefaultTriggerWord,
  getDefaultTriggerEndWord,
} from "@/lib/speech/voiceKeywords";
import type { ResolvedKeyword, ResolvedMultiInputKeyword } from "@/lib/speech/voiceKeywords";

type Tab = "structure" | "operator" | "greek" | "formatting" | "multiInput" | "custom";

const TAB_ORDER: Tab[] = ["structure", "operator", "greek", "formatting", "multiInput", "custom"];

export function VoiceKeywordConfig() {
  const { t } = useTranslation("scratchpad");
  const language = useAppStore((s) => s.language);
  const customKeywords = useAppStore((s) => s.customVoiceKeywords);
  const overrides = useAppStore((s) => s.voiceKeywordOverrides);
  const controlOverrides = useAppStore((s) => s.controlKeywordOverrides);
  const addCustom = useAppStore((s) => s.addCustomVoiceKeyword);
  const removeCustom = useAppStore((s) => s.removeCustomVoiceKeyword);
  const setOverride = useAppStore((s) => s.setVoiceKeywordOverride);
  const removeOverride = useAppStore((s) => s.removeVoiceKeywordOverride);
  const setControlOverride = useAppStore((s) => s.setControlKeywordOverride);
  const triggerEnabled = useAppStore((s) => s.voiceTriggerEnabled);
  const triggerWord = useAppStore((s) => s.voiceTriggerWord);
  const setTriggerEnabled = useAppStore((s) => s.setVoiceTriggerEnabled);
  const setTriggerWord = useAppStore((s) => s.setVoiceTriggerWord);

  const [activeTab, setActiveTab] = useState<Tab>("structure");
  const [newPhrase, setNewPhrase] = useState("");
  const [newReplacement, setNewReplacement] = useState("");

  const effLang = getEffectiveLang(language);
  const resolved = resolveSimpleKeywords(language, overrides);
  const resolvedMulti = resolveMultiInputKeywords(language, overrides);
  const controls = resolveControlKeywords(language, controlOverrides);
  const defaultControls = getControlKeywordPhrases(language);

  // Group simple keywords by category
  const byCategory = new Map<string, ResolvedKeyword[]>();
  for (const r of resolved) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  // Group multi-input keywords by category for sub-sections
  const multiByCategory = new Map<string, ResolvedMultiInputKeyword[]>();
  for (const mk of resolvedMulti) {
    const list = multiByCategory.get(mk.category) ?? [];
    list.push(mk);
    multiByCategory.set(mk.category, list);
  }

  const tabLabel = (tab: Tab) => {
    const labels: Record<Tab, string> = {
      structure: t("delimiters"),
      operator: t("operators"),
      greek: t("greekLetters"),
      formatting: t("formatting"),
      multiInput: t("multiInput"),
      custom: t("customCommands"),
    };
    return labels[tab];
  };

  const categoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      operator: t("operators"),
      formatting: t("formatting"),
      structure: t("delimiters"),
    };
    return labels[cat] ?? cat;
  };

  const handlePhraseChange = (key: string, newPhrase: string) => {
    const existing = overrides[key];
    setOverride(key, { ...existing, phrase: newPhrase });
  };

  const handleReset = (key: string) => {
    removeOverride(key);
  };

  const hasOverride = (key: string) => key in overrides;

  const handleMultiPhraseChange = (key: string, newPhrase: string) => {
    const existing = overrides[key];
    setOverride(key, { ...existing, phrase: newPhrase });
  };

  const handleMultiReset = (key: string) => {
    removeOverride(key);
  };

  const handleControlChange = (field: "endInput", value: string) => {
    const existing = controlOverrides[effLang] ?? {};
    setControlOverride(effLang, { ...existing, [field]: value });
  };

  const handleAddCustom = () => {
    const phrase = newPhrase.trim();
    const replacement = newReplacement.trim();
    if (!phrase || !replacement) return;
    addCustom({ phrase, replacement });
    setNewPhrase("");
    setNewReplacement("");
  };

  const renderSimpleKeywordRows = (keywords: ResolvedKeyword[]) => (
    <div className="space-y-0.5">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center text-[10px] text-muted-foreground/70 px-0.5 mb-1">
        <span>{t("phraseLabel")}</span>
        <span />
        <span>{t("output")}</span>
        <span className="w-6" />
      </div>
      {keywords.map((kw) => (
        <div
          key={kw.key}
          className={`grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center ${
            kw.disabled ? "opacity-40" : ""
          }`}
        >
          <Input
            value={kw.effectivePhrase}
            onChange={(e) => handlePhraseChange(kw.key, e.target.value)}
            placeholder={kw.defaultPhrase}
            className="h-6 text-[11px] font-mono px-1.5"
          />
          <span className="text-muted-foreground text-[10px] px-0.5">&rarr;</span>
          <span className="text-[11px] font-mono text-muted-foreground truncate" title={kw.replacement}>
            {kw.replacement.replace(/\n/g, "↵")}
          </span>
          {hasOverride(kw.key) ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-0.5"
              onClick={() => handleReset(kw.key)}
              title={t("resetToDefault")}
            >
              <RotateCcw className="size-3" />
            </button>
          ) : (
            <span className="w-4" />
          )}
        </div>
      ))}
    </div>
  );

  const renderMultiKeywordRows = (keywords: ResolvedMultiInputKeyword[]) => (
    <div className="space-y-0.5">
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center text-[10px] text-muted-foreground/70 px-0.5 mb-1">
        <span>{t("phraseLabel")}</span>
        <span />
        <span>{t("template")}</span>
        <span className="w-6" />
      </div>
      {keywords.map((mk) => (
        <div
          key={mk.key}
          className={`grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center ${
            mk.disabled ? "opacity-40" : ""
          }`}
        >
          <Input
            value={mk.effectivePhrase}
            onChange={(e) => handleMultiPhraseChange(mk.key, e.target.value)}
            placeholder={mk.defaultPhrase}
            className="h-6 text-[11px] font-mono px-1.5"
          />
          <span className="text-muted-foreground text-[10px] px-0.5">&rarr;</span>
          <span className="text-[11px] font-mono text-muted-foreground truncate" title={mk.template}>
            {mk.template}
          </span>
          {hasOverride(mk.key) ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-0.5"
              onClick={() => handleMultiReset(mk.key)}
              title={t("resetToDefault")}
            >
              <RotateCcw className="size-3" />
            </button>
          ) : (
            <span className="w-4" />
          )}
        </div>
      ))}
    </div>
  );

  const renderMultiInputTab = () => (
    <div className="space-y-3">
      {/* Control keyword editor */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1">{t("controlKeywords")}</p>
        <div>
          <label className="text-[10px] text-muted-foreground">{t("endInputPhrase")}</label>
          <Input
            value={controls.endInput}
            onChange={(e) => handleControlChange("endInput", e.target.value)}
            placeholder={defaultControls.endInput}
            className="h-6 text-[11px] font-mono px-1.5 max-w-48"
          />
        </div>
      </div>

      {/* Trigger word config */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Switch
            checked={triggerEnabled}
            onCheckedChange={setTriggerEnabled}
            className="scale-75"
          />
          <span className="text-[11px] text-foreground">{t("triggerWordLabel")}</span>
        </div>
        {triggerEnabled && (
          <div className="ml-6">
            <Input
              value={triggerWord}
              onChange={(e) => setTriggerWord(e.target.value)}
              placeholder={getDefaultTriggerWord(language)}
              className="h-6 text-[11px] font-mono px-1.5 max-w-48"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t("triggerWordHelp", {
                trigger: triggerWord || getDefaultTriggerWord(language),
                endTrigger: getDefaultTriggerEndWord(language),
              })}
            </p>
          </div>
        )}
      </div>

      {/* Multi-input keyword rows grouped by category */}
      {Array.from(multiByCategory.entries()).map(([cat, keywords]) => (
        <div key={cat}>
          <p className="text-[10px] text-muted-foreground/70 font-medium mb-0.5">{categoryLabel(cat)}</p>
          {renderMultiKeywordRows(keywords)}
        </div>
      ))}

      <p className="text-[10px] text-muted-foreground">
        {t("voiceMultiInputHelp", {
          endInput: controls.endInput,
        })}
      </p>
    </div>
  );

  const renderCustomTab = () => (
    <div className="space-y-2">
      {customKeywords.length > 0 ? (
        <div className="space-y-0.5">
          {customKeywords.map((ck) => (
            <div
              key={ck.phrase}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center"
            >
              <span className="text-[11px] font-mono truncate">{ck.phrase}</span>
              <span className="text-muted-foreground text-[10px] px-0.5">&rarr;</span>
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                {ck.replacement.replace(/\n/g, "↵")}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive p-0.5"
                onClick={() => removeCustom(ck.phrase)}
                title={t("removeCustom")}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t("noCustomCommands")}</p>
      )}

      {/* Add form */}
      <div className="flex gap-1.5 items-end">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">{t("phraseLabel")}</label>
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder={t("phrasePlaceholder")}
            className="h-6 text-[11px] px-1.5"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">{t("replacementLabel")}</label>
          <Input
            value={newReplacement}
            onChange={(e) => setNewReplacement(e.target.value)}
            placeholder={t("replacementPlaceholder")}
            className="h-6 text-[11px] px-1.5"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCustom();
            }}
          />
        </div>
        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={handleAddCustom}
          disabled={!newPhrase.trim() || !newReplacement.trim()}
        >
          {t("addCustom")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="border-t bg-muted/20">
      {/* Category tabs */}
      <div className="flex border-b px-1 gap-0.5 overflow-x-auto">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-2 py-1 text-xs whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "text-foreground border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-3 py-2 max-h-56 overflow-y-auto text-xs">
        {activeTab === "multiInput"
          ? renderMultiInputTab()
          : activeTab === "custom"
            ? renderCustomTab()
            : renderSimpleKeywordRows(byCategory.get(activeTab) ?? [])}
      </div>
    </div>
  );
}
