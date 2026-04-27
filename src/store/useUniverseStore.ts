import { create } from 'zustand';

type AppMode = 'timeline' | 'centerless';

interface UniverseState {
  progress: number; // 0 to 100
  setProgress: (p: number) => void;
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  observerIndex: number | null; // For centerless mode
  setObserverIndex: (idx: number | null) => void;
}

export const useUniverseStore = create<UniverseState>((set) => ({
  progress: 0,
  setProgress: (p) => set({ progress: Math.max(0, Math.min(100, typeof p === 'number' && isNaN(p) ? 0 : p)) }),
  activeMode: 'timeline',
  setActiveMode: (mode) => set((state) => {
    return {
      activeMode: mode,
      isPlaying: false,
      observerIndex: mode === 'centerless' ? state.observerIndex : null,
      progress: mode === 'timeline' ? state.progress : Math.max(state.progress, 72)
    };
  }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  observerIndex: null,
  setObserverIndex: (idx) => set({ observerIndex: idx })
}));
