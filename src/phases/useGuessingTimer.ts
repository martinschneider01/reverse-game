import { useEffect, useRef, useState } from "react";
import { useGameStore, type Phase } from "@/store/gameStore";
import { usePlaybackStore } from "@/store/playbackStore";
import { playTimerBeep } from "@/audio/timerBeep";

const TICK_MS = 250;
/** Warning window: the visual chip flashes and an audible beep fires once per
 *  whole second when the remaining time drops to (0, WARNING_THRESHOLD_MS]
 *  (cf. issue #33). */
export const WARNING_THRESHOLD_MS = 10_000;

export type GuessingTimerState = {
  /** ms remaining; null when no timer rule is active. */
  remainingMs: number | null;
  /** True while remaining is in (0, WARNING_THRESHOLD_MS]. Visual-only —
   *  does NOT depend on inhibition (the chip stays in warning state even when
   *  the audible beep is suppressed by playback or capture). */
  isWarning: boolean;
};

export type GuessingTimerOptions = {
  /** Override the wall-clock source. Tests use this to simulate elapsed time. */
  now?: () => number;
  /** Phases the timer is active in. Defaults to Mode 1 / Challenge phases.
   *  Ouzbek phases pass their own set ({"guessingP2"} or {"guessingP4"}). */
  activePhases?: ReadonlySet<Phase>;
  /** Audio context used for the warning beep. Optional — when absent, the
   *  visual warning still fires but no sound is emitted. */
  audioContext?: AudioContext | null;
  /** Injected for tests so we can assert the call without instantiating Web
   *  Audio. Defaults to playTimerBeep. */
  beep?: (ctx: AudioContext) => void;
  /** Injected for tests; defaults to reading playbackStore. Returns true when
   *  the beep must be suppressed (an AudioPlayer is playing or an
   *  AudioRecorder is capturing). */
  isAudioInhibited?: () => boolean;
};

const DEFAULT_ACTIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>(["guessing", "confirmEnd"]);

function defaultIsAudioInhibited(): boolean {
  const s = usePlaybackStore.getState();
  return s.currentPlayingId !== null || s.capturingCount > 0;
}

/** Wall-clock countdown for Mode Challenge (and its Ouzbek variant). Reads
 *  `challengeRules.timerMs` and `guessingStartedAt` from the store, ticks every
 *  TICK_MS, and dispatches `forceReveal()` when the deadline passes — the
 *  store routes that to the right next phase based on the current phase
 *  (cf. PROJECT.md §3.12 + §3.13). Pausing during re-listens is intentional
 *  (cf. §3.12). During the last 10 seconds the hook also surfaces an
 *  `isWarning` flag (visual-only) and fires a once-per-second beep on the
 *  injected AudioContext, suppressed while audio playback or capture is
 *  active (cf. issue #33). */
export function useGuessingTimer(options: GuessingTimerOptions = {}): GuessingTimerState {
  const now = options.now ?? Date.now;
  const activePhases = options.activePhases ?? DEFAULT_ACTIVE_PHASES;
  const audioContext = options.audioContext ?? null;
  const beep = options.beep ?? playTimerBeep;
  const isAudioInhibited = options.isAudioInhibited ?? defaultIsAudioInhibited;

  const timerMs = useGameStore((s) => s.challengeRules?.timerMs ?? null);
  const startedAt = useGameStore((s) => s.guessingStartedAt);
  const phase = useGameStore((s) => s.phase);
  const forceReveal = useGameStore((s) => s.forceReveal);

  const active = timerMs !== null && startedAt !== null && activePhases.has(phase);

  function compute(): number | null {
    if (!active || timerMs === null || startedAt === null) return null;
    return Math.max(0, timerMs - (now() - startedAt));
  }

  const [remainingMs, setRemainingMs] = useState<number | null>(compute);

  // Tracks the last second value (1..10) at which we emitted a beep so we
  // throttle to one beep per whole second crossing during the warning window.
  // Reset to null when we leave the window or the timer is reset.
  const lastBeepSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || timerMs === null || startedAt === null) {
      setRemainingMs(null);
      lastBeepSecondRef.current = null;
      return;
    }
    function tick(): void {
      const rem = Math.max(0, timerMs! - (now() - startedAt!));
      setRemainingMs(rem);

      const inWarning = rem > 0 && rem <= WARNING_THRESHOLD_MS;
      if (inWarning) {
        // Bucket by the displayed second (1..10). ceil so 10000ms is "10",
        // 9001ms is "10", 9000ms is "9", 1ms is "1", 0ms is no longer in
        // the window. This matches the chip's mm:ss formatting.
        const second = Math.ceil(rem / 1000);
        if (lastBeepSecondRef.current !== second) {
          lastBeepSecondRef.current = second;
          if (audioContext !== null && !isAudioInhibited()) {
            beep(audioContext);
          }
        }
      } else {
        lastBeepSecondRef.current = null;
      }

      if (rem <= 0) forceReveal();
    }
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [active, timerMs, startedAt, forceReveal, now, audioContext, beep, isAudioInhibited]);

  const isWarning = remainingMs !== null && remainingMs > 0 && remainingMs <= WARNING_THRESHOLD_MS;

  return { remainingMs, isWarning };
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
