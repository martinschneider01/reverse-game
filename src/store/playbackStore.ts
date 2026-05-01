import { create } from "zustand";

export type PlaybackState = {
  currentPlayingId: string | null;
  setPlaying: (id: string) => void;
  clearPlaying: (id: string) => void;
};

export const INITIAL_PLAYBACK_STATE: Pick<PlaybackState, "currentPlayingId"> = {
  currentPlayingId: null,
};

export const usePlaybackStore = create<PlaybackState>((set) => ({
  ...INITIAL_PLAYBACK_STATE,
  setPlaying: (id) => set({ currentPlayingId: id }),
  clearPlaying: (id) => set((s) => (s.currentPlayingId === id ? { currentPlayingId: null } : {})),
}));
