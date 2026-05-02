import { create } from "zustand";

export type PlaybackState = {
  currentPlayingId: string | null;
  /** True while at least one AudioRecorder is capturing. Used by the timer
   *  warning to inhibit the audible beep so it doesn't bleed into the user's
   *  recording (cf. issue #33). */
  capturingCount: number;
  setPlaying: (id: string) => void;
  clearPlaying: (id: string) => void;
  startCapturing: () => void;
  stopCapturing: () => void;
};

export const INITIAL_PLAYBACK_STATE: Pick<PlaybackState, "currentPlayingId" | "capturingCount"> = {
  currentPlayingId: null,
  capturingCount: 0,
};

export const usePlaybackStore = create<PlaybackState>((set) => ({
  ...INITIAL_PLAYBACK_STATE,
  setPlaying: (id) => set({ currentPlayingId: id }),
  clearPlaying: (id) => set((s) => (s.currentPlayingId === id ? { currentPlayingId: null } : {})),
  startCapturing: () => set((s) => ({ capturingCount: s.capturingCount + 1 })),
  stopCapturing: () => set((s) => ({ capturingCount: Math.max(0, s.capturingCount - 1) })),
}));
