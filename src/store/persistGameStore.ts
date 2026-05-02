import { useGameStore, type GameState } from "./gameStore";
import {
  savePersistedState,
  clearPersistedState,
  type PersistedState,
  type PersistedPhase,
} from "./persistence";

const SAVE_DEBOUNCE_MS = 200;

const SAVABLE_PHASES: ReadonlySet<PersistedPhase> = new Set(["guessing", "confirmEnd", "reveal"]);

function isSavablePhase(phase: GameState["phase"]): phase is PersistedPhase {
  return SAVABLE_PHASES.has(phase as PersistedPhase);
}

function snapshot(s: GameState): PersistedState | null {
  if (!isSavablePhase(s.phase)) return null;
  if (s.originalRecording === null) return null;
  return {
    version: 1,
    phase: s.phase,
    originalRecording: {
      blob: s.originalRecording.blob,
      durationMs: s.originalRecording.durationMs,
    },
    guessRecording:
      s.guessRecording !== null
        ? { blob: s.guessRecording.blob, durationMs: s.guessRecording.durationMs }
        : null,
    notes: s.notes,
    listenCount: s.listenCount,
    challengeRules: s.challengeRules,
    guessingStartedAt: s.guessingStartedAt,
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
