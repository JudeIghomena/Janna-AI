import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccentColor, Theme, UISettings } from "@/types";
import { DEFAULT_MODEL_ID } from "@janna/shared";

interface UIState extends UISettings {
  sidebarOpen: boolean;
  activityPanelOpen: boolean;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: UISettings["fontSize"]) => void;
  setRagEnabled: (enabled: boolean) => void;
  setSelectedModelId: (id: string) => void;
  toggleSidebar: () => void;
  setActivityPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      accentColor: "violet",
      fontSize: "md",
      ragEnabled: false,
      selectedModelId: DEFAULT_MODEL_ID,
      sidebarOpen: true,
      activityPanelOpen: false,

      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      setRagEnabled: (ragEnabled) => set({ ragEnabled }),
      setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setActivityPanelOpen: (activityPanelOpen) => set({ activityPanelOpen }),
    }),
    { name: "janna-ui" }
  )
);
