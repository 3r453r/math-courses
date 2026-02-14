import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomKeyword, KeywordOverride } from "@/lib/speech/voiceKeywords";

interface AppState {
  apiKey: string | null;
  sidebarOpen: boolean;
  chatSidebarOpen: boolean;
  scratchpadOpen: boolean;
  notebookOpen: boolean;
  generationModel: string;
  chatModel: string;
  language: string;
  customVoiceKeywords: CustomKeyword[];
  voiceKeywordOverrides: Record<string, KeywordOverride>;
  controlKeywordOverrides: Record<string, { endInput?: string }>;
  voiceAiMode: boolean;
  voiceTriggerEnabled: boolean;
  voiceTriggerWord: string;
  setApiKey: (key: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setChatSidebarOpen: (open: boolean) => void;
  setScratchpadOpen: (open: boolean) => void;
  setNotebookOpen: (open: boolean) => void;
  setGenerationModel: (model: string) => void;
  setChatModel: (model: string) => void;
  setLanguage: (lang: string) => void;
  addCustomVoiceKeyword: (keyword: CustomKeyword) => void;
  removeCustomVoiceKeyword: (phrase: string) => void;
  setVoiceKeywordOverride: (key: string, override: KeywordOverride) => void;
  removeVoiceKeywordOverride: (key: string) => void;
  setControlKeywordOverride: (lang: string, override: { endInput?: string }) => void;
  setVoiceAiMode: (enabled: boolean) => void;
  setVoiceTriggerEnabled: (enabled: boolean) => void;
  setVoiceTriggerWord: (word: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: null,
      sidebarOpen: true,
      chatSidebarOpen: false,
      scratchpadOpen: false,
      notebookOpen: false,
      generationModel: "claude-opus-4-20250514",
      chatModel: "claude-sonnet-4-20250514",
      language: "en",
      customVoiceKeywords: [],
      voiceKeywordOverrides: {},
      controlKeywordOverrides: {},
      voiceAiMode: false,
      voiceTriggerEnabled: false,
      voiceTriggerWord: "",
      setApiKey: (key) => set({ apiKey: key }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setChatSidebarOpen: (open) => set({ chatSidebarOpen: open }),
      setScratchpadOpen: (open) => set({ scratchpadOpen: open }),
      setNotebookOpen: (open) => set({ notebookOpen: open }),
      setGenerationModel: (model) => set({ generationModel: model }),
      setChatModel: (model) => set({ chatModel: model }),
      setLanguage: (lang) => set({ language: lang }),
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
    }),
    {
      name: "math-courses-app",
    }
  )
);
