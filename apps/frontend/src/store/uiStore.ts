import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UISettings, ThemeMode } from '@/types';
import type { Artifact } from '@/components/chat/ArtifactsPanel';

interface UIState extends UISettings {
  sidebarOpen: boolean;
  activityPanelOpen: boolean;
  artifactsPanelOpen: boolean;
  artifacts: Artifact[];
  settingsOpen: boolean;

  // Setters
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  setFontSize: (size: UISettings['fontSize']) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleActivityPanel: () => void;
  setActivityPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSendOnEnter: (v: boolean) => void;
  setShowLineNumbers: (v: boolean) => void;
  setCompactMode: (v: boolean) => void;
  // Artifacts
  addArtifact: (artifact: Artifact) => void;
  clearArtifacts: () => void;
  setArtifactsPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Default settings
      theme: 'system',
      accentColor: 'oklch(65% 0.18 35)',
      fontSize: 'md',
      compactMode: false,
      sendOnEnter: true,
      showLineNumbers: true,
      sidebarOpen: true,
      activityPanelOpen: false,
      artifactsPanelOpen: false,
      artifacts: [],
      settingsOpen: false,

      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleActivityPanel: () =>
        set((s) => ({ activityPanelOpen: !s.activityPanelOpen })),
      setActivityPanelOpen: (activityPanelOpen) => set({ activityPanelOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSendOnEnter: (sendOnEnter) => set({ sendOnEnter }),
      setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
      setCompactMode: (compactMode) => set({ compactMode }),
      addArtifact: (artifact) =>
        set((s) => ({
          artifacts: [...s.artifacts, artifact],
          artifactsPanelOpen: true,
        })),
      clearArtifacts: () => set({ artifacts: [], artifactsPanelOpen: false }),
      setArtifactsPanelOpen: (artifactsPanelOpen) =>
        set({ artifactsPanelOpen }),
    }),
    {
      name: 'janna-ui-settings',
      partialize: (state) => ({
        theme: state.theme,
        accentColor: state.accentColor,
        fontSize: state.fontSize,
        compactMode: state.compactMode,
        sendOnEnter: state.sendOnEnter,
        showLineNumbers: state.showLineNumbers,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
