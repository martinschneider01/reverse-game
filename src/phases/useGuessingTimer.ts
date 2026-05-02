import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

const TICK_MS = 250;

export type GuessingTimerState = {
  /** ms remaining; null when no timer rule is active. */
  remainingMs: number | null;
};

/** Wall-clock countdown for Mode Challenge. Reads `challengeRules.timerMs` and
 *  `guessingStartedAt` from the store, ticks every TICK_MS, and dispatches
 *  `forceReveal()` when the deadline passes. Pausing during re-listens is not
 *  supported — wall-clock is intentional (cf. §3.12). */
export function useGuessingTimer(now: () => number = Date.now): GuessingTimerState {
  const timerMs = useGameStore((s) => s.challengeRules?.timerMs ?? null);
  const startedAt = useGameStore((s) => s.guessingStartedAt);
  const phase = useGameStore((s) => s.phase);
  const forceReveal = useGameStore((s) => s.forceReveal);

  const active =
    timerMs !== null && startedAt !== null && (phase === "guessing" || phase === "confirmEnd");

  function compute(): number | null {
    if (!active || timerMs === null || startedAt === null) return null;
    return Math.max(0, timerMs - (now() - startedAt));
  }

  const [remainingMs, setRemainingMs] = useState<number | null>(compute);

  useEffect(() => {
    if (!active || timerMs === null || startedAt === null) {
      setRemainingMs(null);
      return;
    }
    function tick(): void {
      const rem = Math.max(0, timerMs! - (now() - startedAt!));
      setRemainingMs(rem);
      if (rem <= 0) forceReveal();
    }
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [active, timerMs, startedAt, forceReveal, now]);

  return { remainingMs };
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
