import { create } from "zustand";
import type { Recording } from "@/audio/recording";

export type Phase =
  | "menu"
  | "permission"
  | "permissionDenied"
  | "recordingA"
  | "guessing"
  | "confirmEnd"
  | "reveal";

export type GameState = {
  phase: Phase;
  originalRecording: Recording | null;
  guessRecording: Recording | null;
  notes: string;
  listenCount: number;

  startGame: () => void;
  permissionGranted: () => void;
  permissionDenied: () => void;
  retryPermission: () => void;
  finishRecordingA: (recording: Recording) => void;
  setNotes: (notes: string) => void;
  setGuessRecording: (recording: Recording | null) => void;
  incrementListenCount: () => void;
  endGuessing: () => void;
  cancelEnd: () => void;
  confirmEnd: () => void;
  newRound: () => void;
  backToMenu: () => void;
};

type ActionKey =
  | "startGame"
  | "permissionGranted"
  | "permissionDenied"
  | "retryPermission"
  | "finishRecordingA"
  | "setNotes"
  | "setGuessRecording"
  | "incrementListenCount"
  | "endGuessing"
  | "cancelEnd"
  | "confirmEnd"
  | "newRound"
  | "backToMenu";

type Slice = Omit<GameState, ActionKey>;

export const INITIAL_STATE: Slice = {
  phase: "menu",
  originalRecording: null,
  guessRecording: null,
  notes: "",
  listenCount: 0,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  startGame: () => set((s) => (s.phase === "menu" ? { phase: "permission" } : {})),

  permissionGranted: () => set((s) => (s.phase === "permission" ? { phase: "recordingA" } : {})),

  permissionDenied: () =>
    set((s) => (s.phase === "permission" ? { phase: "permissionDenied" } : {})),

  retryPermission: () =>
    set((s) => (s.phase === "permissionDenied" ? { phase: "permission" } : {})),

  finishRecordingA: (recording) =>
    set((s) =>
      s.phase === "recordingA" ? { phase: "guessing", originalRecording: recording } : {},
    ),

  setNotes: (notes) => set((s) => (s.phase === "guessing" ? { notes } : {})),

  setGuessRecording: (recording) =>
    set((s) => (s.phase === "guessing" ? { guessRecording: recording } : {})),

  incrementListenCount: () => set((s) => ({ listenCount: s.listenCount + 1 })),

  endGuessing: () => set((s) => (s.phase === "guessing" ? { phase: "confirmEnd" } : {})),

  cancelEnd: () => set((s) => (s.phase === "confirmEnd" ? { phase: "guessing" } : {})),

  confirmEnd: () => set((s) => (s.phase === "confirmEnd" ? { phase: "reveal" } : {})),

  newRound: () =>
    set((s) =>
      s.phase === "reveal"
        ? {
            phase: "recordingA",
            originalRecording: null,
            guessRecording: null,
            notes: "",
            listenCount: 0,
          }
        : {},
    ),

  backToMenu: () => set({ ...INITIAL_STATE }),
}));
