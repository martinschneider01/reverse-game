import { create } from "zustand";
import type { Recording } from "@/audio/recording";

export type Phase = "menu" | "permission" | "permissionDenied" | "handoffA" | "recordingA" | "done";

export type GameState = {
  phase: Phase;
  originalRecording: Recording | null;
  guessRecording: Recording | null;
  notes: string;

  startGame: () => void;
  permissionGranted: () => void;
  permissionDenied: () => void;
  retryPermission: () => void;
  confirmHandoffA: () => void;
  finishRecordingA: (recording: Recording) => void;
  backToMenu: () => void;
};

type Slice = Omit<
  GameState,
  | "startGame"
  | "permissionGranted"
  | "permissionDenied"
  | "retryPermission"
  | "confirmHandoffA"
  | "finishRecordingA"
  | "backToMenu"
>;

export const INITIAL_STATE: Slice = {
  phase: "menu",
  originalRecording: null,
  guessRecording: null,
  notes: "",
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  startGame: () => set((s) => (s.phase === "menu" ? { phase: "permission" } : {})),

  permissionGranted: () => set((s) => (s.phase === "permission" ? { phase: "handoffA" } : {})),

  permissionDenied: () =>
    set((s) => (s.phase === "permission" ? { phase: "permissionDenied" } : {})),

  retryPermission: () =>
    set((s) => (s.phase === "permissionDenied" ? { phase: "permission" } : {})),

  confirmHandoffA: () => set((s) => (s.phase === "handoffA" ? { phase: "recordingA" } : {})),

  finishRecordingA: (recording) =>
    set((s) => (s.phase === "recordingA" ? { phase: "done", originalRecording: recording } : {})),

  backToMenu: () => set({ ...INITIAL_STATE }),
}));
