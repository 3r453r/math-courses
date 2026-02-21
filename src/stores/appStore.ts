import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomKeyword, KeywordOverride } from "@/lib/speech/voiceKeywords";
import type { AIProvider, ProviderApiKeys } from "@/lib/ai/client";
import type { ColorThemeId } from "@/lib/themes";

interface AppState {
  apiKeys: ProviderApiKeys;
  sidebarOpen: boolean;
  chatSidebarOpen: boolean;
  scratchpadOpen: boolean;
  notebookOpen: boolean;
  generationModel: string;
  chatModel: string;
  language: string;
  colorTheme: ColorThemeId;
  customVoiceKeywords: CustomKeyword[];
  voiceKeywordOverrides: Record<string, KeywordOverride>;
  controlKeywordOverrides: Record<string, { endInput?: string }>;
  voiceAiMode: boolean;
  voiceTriggerEnabled: boolean;
  voiceTriggerWord: string;
  syncApiKeysToServer: boolean;
  contextDocGuideDismissed: boolean;
  installPromptDismissed: boolean;
  freeResponseCheckMode: "ai" | "solution";
  setSyncApiKeysToServer: (value: boolean) => void;
  setFreeResponseCheckMode: (mode: "ai" | "solution") => void;
  setProviderApiKey: (provider: AIProvider, key: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setChatSidebarOpen: (open: boolean) => void;
  setScratchpadOpen: (open: boolean) => void;
  setNotebookOpen: (open: boolean) => void;
  setGenerationModel: (model: string) => void;
  setChatModel: (model: string) => void;
  setLanguage: (lang: string) => void;
  setColorTheme: (theme: ColorThemeId) => void;
  addCustomVoiceKeyword: (keyword: CustomKeyword) => void;
  removeCustomVoiceKeyword: (phrase: string) => void;
  setVoiceKeywordOverride: (key: string, override: KeywordOverride) => void;
  removeVoiceKeywordOverride: (key: string) => void;
  setControlKeywordOverride: (lang: string, override: { endInput?: string }) => void;
  setVoiceAiMode: (enabled: boolean) => void;
  setVoiceTriggerEnabled: (enabled: boolean) => void;
  setVoiceTriggerWord: (word: string) => void;
  setContextDocGuideDismissed: (v: boolean) => void;
  setInstallPromptDismissed: (v: boolean) => void;
  setApiKeys: (keys: ProviderApiKeys) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKeys: {},
      sidebarOpen: true,
      chatSidebarOpen: false,
      scratchpadOpen: false,
      notebookOpen: false,
      generationModel: "claude-sonnet-4-6",
      chatModel: "claude-sonnet-4-6",
      language: "en",
      colorTheme: "neutral",
      customVoiceKeywords: [],
      voiceKeywordOverrides: {},
      controlKeywordOverrides: {},
      voiceAiMode: false,
      voiceTriggerEnabled: false,
      voiceTriggerWord: "",
      syncApiKeysToServer: false,
      contextDocGuideDismissed: false,
      installPromptDismissed: false,
      freeResponseCheckMode: "solution",
      setSyncApiKeysToServer: (value) => set({ syncApiKeysToServer: value }),
      setFreeResponseCheckMode: (mode) => set({ freeResponseCheckMode: mode }),
      setProviderApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [provider]: key ?? undefined,
          },
        })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setChatSidebarOpen: (open) => set({ chatSidebarOpen: open }),
      setScratchpadOpen: (open) => set({ scratchpadOpen: open }),
      setNotebookOpen: (open) => set({ notebookOpen: open }),
      setGenerationModel: (model) => set({ generationModel: model }),
      setChatModel: (model) => set({ chatModel: model }),
      setLanguage: (lang) => set({ language: lang }),
      setColorTheme: (theme) => set({ colorTheme: theme }),
      addCustomVoiceKeyword: (keyword) =>
        set((state) => ({
          customVoiceKeywords: [
            ...state.customVoiceKeywords.filter((k) => k.phrase !== keyword.phrase),
            keyword,
          ],
        })),
      removeCustomVoiceKeyword: (phrase) =>
        set((state) => ({
          customVoiceKeywords: state.customVoiceKeywords.filter((k) => k.phrase !== phrase),
        })),
      setVoiceKeywordOverride: (key, override) =>
        set((state) => ({
          voiceKeywordOverrides: { ...state.voiceKeywordOverrides, [key]: override },
        })),
      removeVoiceKeywordOverride: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.voiceKeywordOverrides;
          return { voiceKeywordOverrides: rest };
        }),
      setControlKeywordOverride: (lang, override) =>
        set((state) => ({
          controlKeywordOverrides: { ...state.controlKeywordOverrides, [lang]: override },
        })),
      setVoiceAiMode: (enabled) => set({ voiceAiMode: enabled }),
      setVoiceTriggerEnabled: (enabled) => set({ voiceTriggerEnabled: enabled }),
      setVoiceTriggerWord: (word) => set({ voiceTriggerWord: word }),
      setContextDocGuideDismissed: (v) => set({ contextDocGuideDismissed: v }),
      setInstallPromptDismissed: (v) => set({ installPromptDismissed: v }),
      setApiKeys: (keys) => set({ apiKeys: keys }),
    }),
    {
      name: "math-courses-app",
      // Exclude API keys from localStorage — they should only live in memory
      // (for the current session) or encrypted on the server. Persisting to
      // localStorage exposes them to XSS-based credential theft.
      partialize: (state) => {
        const { apiKeys: _keys, ...rest } = state;
        return rest;
      },
    }
  )
);

/** Returns true if at least one provider API key is configured */
export function useHasAnyApiKey(): boolean {
  const apiKeys = useAppStore((s) => s.apiKeys);
  return !!(apiKeys.anthropic || apiKeys.openai || apiKeys.google);
}
