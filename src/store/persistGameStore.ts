import { useGameStore, type GameState } from "./gameStore";
import {
  savePersistedState,
  clearPersistedState,
  type PersistedState,
  type PersistedPhase,
} from "./persistence";

const SAVE_DEBOUNCE_MS = 200;

const SAVABLE_PHASES: ReadonlySet<PersistedPhase> = new Set([
  // Mode 1 / Challenge
  "guessing",
  "confirmEnd",
  "reveal",
  // Mode Ouzbek (cf. §3.13). recordingP1 / recordingP3 are not savable —
  // an active MediaRecorder can't be resumed cleanly after a lock screen.
  "handoffP2",
  "guessingP2",
  "handoffP3",
  "handoffP4",
  "guessingP4",
  "revealOuzbek",
]);

function isSavablePhase(phase: GameState["phase"]): phase is PersistedPhase {
  return SAVABLE_PHASES.has(phase as PersistedPhase);
}

function snapshot(s: GameState): PersistedState | null {
  if (!isSavablePhase(s.phase)) return null;
  // Mode 1 round needs originalRecording; Ouzbek round needs ouzbekRecordingP1.
  if (s.mode === "mode1" && s.originalRecording === null) return null;
  if (s.mode === "ouzbek" && s.ouzbekRecordingP1 === null) return null;
  return {
    version: 1,
    phase: s.phase,
    mode: s.mode,
    originalRecording:
      s.originalRecording !== null
        ? { blob: s.originalRecording.blob, durationMs: s.originalRecording.durationMs }
        : null,
    guessRecording:
      s.guessRecording !== null
        ? { blob: s.guessRecording.blob, durationMs: s.guessRecording.durationMs }
        : null,
    notes: s.notes,
    listenCount: s.listenCount,
    challengeRules: s.challengeRules,
    guessingStartedAt: s.guessingStartedAt,
    ouzbekRecordingP1:
      s.ouzbekRecordingP1 !== null
        ? { blob: s.ouzbekRecordingP1.blob, durationMs: s.ouzbekRecordingP1.durationMs }
        : null,
    ouzbekThemeP1: s.ouzbekThemeP1,
    ouzbekNoteP2: s.ouzbekNoteP2,
    ouzbekRecordingP3:
      s.ouzbekRecordingP3 !== null
        ? { blob: s.ouzbekRecordingP3.blob, durationMs: s.ouzbekRecordingP3.durationMs }
        : null,
  };
}

export type StartPersistenceOptions = {
  debounceMs?: number;
  save?: (state: PersistedState) => Promise<void>;
  clear?: () => Promise<void>;
};

export function startGameStorePersistence(options: StartPersistenceOptions = {}): () => void {
  const debounceMs = options.debounceMs ?? SAVE_DEBOUNCE_MS;
  const save = options.save ?? savePersistedState;
  const clear = options.clear ?? clearPersistedState;

  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    const persisted = snapshot(useGameStore.getState());
    if (persisted !== null) {
      void save(persisted);
    } else {
      void clear();
    }
  }

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  const unsub = useGameStore.subscribe(schedule);

  return () => {
    unsub();
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
