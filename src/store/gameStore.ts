import { create } from "zustand";
import type { Recording } from "@/audio/recording";

export type Phase =
  | "menu"
  | "challengeConfig"
  | "permission"
  | "permissionDenied"
  | "recordingA"
  | "guessing"
  | "confirmEnd"
  | "reveal"
  // Mode Téléphone Ouzbek (cf. PROJECT.md §3.13)
  | "recordingP1"
  | "handoffP2"
  | "guessingP2"
  | "handoffP3"
  | "recordingP3"
  | "handoffP4"
  | "guessingP4"
  | "revealOuzbek";

export type GameMode = "mode1" | "ouzbek";

export type ChallengeRules = {
  /** Durée de la phase guessing en ms. null = pas de timer (comportement Mode 1). */
  timerMs: number | null;
  /** Si false, <NotesEditor /> n'est pas rendu et la section notes est absente du reveal. */
  notesEnabled: boolean;
  /** Plafond de ré-écoutes ; bouton "Écouter" désactivé quand listenCount >= listenLimit.
   *  null = illimité (comportement Mode 1). */
  listenLimit: number | null;
};

export const DEFAULT_CHALLENGE_RULES: ChallengeRules = {
  timerMs: null,
  notesEnabled: true,
  listenLimit: null,
};

export type GameState = {
  phase: Phase;
  /** Mode du round actif. Discrimine la branche post-permission
   *  (recordingA vs recordingP1) et l'identité du round jusqu'au backToMenu. */
  mode: GameMode;
  originalRecording: Recording | null;
  guessRecording: Recording | null;
  notes: string;
  listenCount: number;
  challengeRules: ChallengeRules | null;
  /** Wall-clock epoch ms when the guessing phase was entered. Set only when a
   *  timer rule is active (cf. §3.12). Used to compute remaining time on each
   *  render and to resume the countdown after a lock-screen/PWA unload. */
  guessingStartedAt: number | null;

  // Mode Téléphone Ouzbek (cf. §3.13)
  ouzbekRecordingP1: Recording | null;
  ouzbekNoteP2: string;
  ouzbekRecordingP3: Recording | null;

  startGame: () => void;
  startChallenge: () => void;
  confirmChallengeRules: (rules: ChallengeRules) => void;
  startOuzbek: () => void;
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
  /** Forced transition guessing|confirmEnd → reveal triggered by timer expiry. */
  forceReveal: () => void;
  newRound: () => void;
  backToMenu: () => void;

  // Mode Ouzbek actions (cf. §3.13)
  finishRecordingP1: (recording: Recording) => void;
  startGuessingP2: () => void;
  setOuzbekNoteP2: (note: string) => void;
  finishGuessingP2: () => void;
  startRecordingP3: () => void;
  finishRecordingP3: (recording: Recording) => void;
  startGuessingP4: () => void;
  revealOuzbekChain: () => void;
  newOuzbekRound: () => void;
};

type ActionKey =
  | "startGame"
  | "startChallenge"
  | "confirmChallengeRules"
  | "startOuzbek"
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
  | "forceReveal"
  | "newRound"
  | "backToMenu"
  | "finishRecordingP1"
  | "startGuessingP2"
  | "setOuzbekNoteP2"
  | "finishGuessingP2"
  | "startRecordingP3"
  | "finishRecordingP3"
  | "startGuessingP4"
  | "revealOuzbekChain"
  | "newOuzbekRound";

type Slice = Omit<GameState, ActionKey>;

export const INITIAL_STATE: Slice = {
  phase: "menu",
  mode: "mode1",
  originalRecording: null,
  guessRecording: null,
  notes: "",
  listenCount: 0,
  challengeRules: null,
  guessingStartedAt: null,
  ouzbekRecordingP1: null,
  ouzbekNoteP2: "",
  ouzbekRecordingP3: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  startGame: () => set((s) => (s.phase === "menu" ? { phase: "permission", mode: "mode1" } : {})),

  startChallenge: () =>
    set((s) => (s.phase === "menu" ? { phase: "challengeConfig", mode: "mode1" } : {})),

  confirmChallengeRules: (rules) =>
    set((s) =>
      s.phase === "challengeConfig" ? { phase: "permission", challengeRules: rules } : {},
    ),

  startOuzbek: () =>
    set((s) => (s.phase === "menu" ? { phase: "permission", mode: "ouzbek" } : {})),

  permissionGranted: () =>
    set((s) => {
      if (s.phase !== "permission") return {};
      return { phase: s.mode === "ouzbek" ? "recordingP1" : "recordingA" };
    }),

  permissionDenied: () =>
    set((s) => (s.phase === "permission" ? { phase: "permissionDenied" } : {})),

  retryPermission: () =>
    set((s) => (s.phase === "permissionDenied" ? { phase: "permission" } : {})),

  finishRecordingA: (recording) =>
    set((s) => {
      if (s.phase !== "recordingA") return {};
      const startedAt = s.challengeRules?.timerMs != null ? Date.now() : null;
      return {
        phase: "guessing",
        originalRecording: recording,
        guessingStartedAt: startedAt,
      };
    }),

  setNotes: (notes) => set((s) => (s.phase === "guessing" ? { notes } : {})),

  setGuessRecording: (recording) =>
    set((s) => (s.phase === "guessing" ? { guessRecording: recording } : {})),

  incrementListenCount: () => set((s) => ({ listenCount: s.listenCount + 1 })),

  endGuessing: () => set((s) => (s.phase === "guessing" ? { phase: "confirmEnd" } : {})),

  cancelEnd: () => set((s) => (s.phase === "confirmEnd" ? { phase: "guessing" } : {})),

  confirmEnd: () =>
    set((s) => (s.phase === "confirmEnd" ? { phase: "reveal", guessingStartedAt: null } : {})),

  forceReveal: () =>
    set((s) =>
      s.phase === "guessing" || s.phase === "confirmEnd"
        ? { phase: "reveal", guessingStartedAt: null }
        : {},
    ),

  newRound: () =>
    set((s) =>
      s.phase === "reveal"
        ? {
            phase: "recordingA",
            originalRecording: null,
            guessRecording: null,
            notes: "",
            listenCount: 0,
            guessingStartedAt: null,
          }
        : {},
    ),

  backToMenu: () => set({ ...INITIAL_STATE }),

  finishRecordingP1: (recording) =>
    set((s) =>
      s.phase === "recordingP1" ? { phase: "handoffP2", ouzbekRecordingP1: recording } : {},
    ),

  startGuessingP2: () => set((s) => (s.phase === "handoffP2" ? { phase: "guessingP2" } : {})),

  setOuzbekNoteP2: (note) => set((s) => (s.phase === "guessingP2" ? { ouzbekNoteP2: note } : {})),

  finishGuessingP2: () => set((s) => (s.phase === "guessingP2" ? { phase: "handoffP3" } : {})),

  startRecordingP3: () => set((s) => (s.phase === "handoffP3" ? { phase: "recordingP3" } : {})),

  finishRecordingP3: (recording) =>
    set((s) =>
      s.phase === "recordingP3" ? { phase: "handoffP4", ouzbekRecordingP3: recording } : {},
    ),

  startGuessingP4: () => set((s) => (s.phase === "handoffP4" ? { phase: "guessingP4" } : {})),

  revealOuzbekChain: () => set((s) => (s.phase === "guessingP4" ? { phase: "revealOuzbek" } : {})),

  newOuzbekRound: () =>
    set((s) =>
      s.phase === "revealOuzbek"
        ? {
            phase: "recordingP1",
            ouzbekRecordingP1: null,
            ouzbekNoteP2: "",
            ouzbekRecordingP3: null,
          }
        : {},
    ),
}));
