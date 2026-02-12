import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  apiKey: string | null;
  sidebarOpen: boolean;
  chatSidebarOpen: boolean;
  generationModel: string;
  chatModel: string;
  setApiKey: (key: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setChatSidebarOpen: (open: boolean) => void;
  setGenerationModel: (model: string) => void;
  setChatModel: (model: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: null,
      sidebarOpen: true,
      chatSidebarOpen: false,
      generationModel: "claude-opus-4-20250514",
      chatModel: "claude-sonnet-4-20250514",
      setApiKey: (key) => set({ apiKey: key }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setChatSidebarOpen: (open) => set({ chatSidebarOpen: open }),
      setGenerationModel: (model) => set({ generationModel: model }),
      setChatModel: (model) => set({ chatModel: model }),
    }),
    {
      name: "math-courses-app",
    }
  )
);
