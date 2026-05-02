import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useGameStore, INITIAL_STATE, DEFAULT_CHALLENGE_RULES } from "@/store/gameStore";
import { useGuessingTimer, formatRemaining } from "./useGuessingTimer";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  gain: 1,
  blob: new Blob(),
};

function Probe({ now, onState }: { now: () => number; onState: (ms: number | null) => void }) {
  const { remainingMs } = useGuessingTimer({ now });
  onState(remainingMs);
  return null;
}

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useGuessingTimer", () => {
  it("returns null when no challenge rules are set", () => {
    let last: number | null | undefined;
    render(<Probe now={() => 0} onState={(v) => (last = v)} />);
    expect(last).toBeNull();
  });

  it("returns null when timerMs is null even if guessing", () => {
    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: null },
      guessingStartedAt: 1000,
    });
    let last: number | null | undefined;
    render(<Probe now={() => 1500} onState={(v) => (last = v)} />);
    expect(last).toBeNull();
  });

  it("returns the wall-clock remaining time when active", () => {
    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: 60_000 },
      guessingStartedAt: 1000,
    });
    let last: number | null | undefined;
    render(<Probe now={() => 11_000} onState={(v) => (last = v)} />);
    expect(last).toBe(50_000);
  });

  it("dispatches forceReveal when remaining hits zero", () => {
    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: 60_000 },
      guessingStartedAt: 0,
    });
    let nowMs = 0;
    render(<Probe now={() => nowMs} onState={() => {}} />);
    expect(useGameStore.getState().phase).toBe("guessing");

    act(() => {
      nowMs = 60_000;
      vi.advanceTimersByTime(1000);
    });

    expect(useGameStore.getState().phase).toBe("reveal");
    expect(useGameStore.getState().guessingStartedAt).toBeNull();
  });

  it("forces reveal immediately on mount when the timer has already expired", () => {
    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: 60_000 },
      guessingStartedAt: 0,
    });
    render(<Probe now={() => 999_999} onState={() => {}} />);
    expect(useGameStore.getState().phase).toBe("reveal");
  });

  it("keeps ticking while in confirmEnd (the dialog is an overlay over guessing)", () => {
    useGameStore.setState({
      phase: "confirmEnd",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: 60_000 },
      guessingStartedAt: 0,
    });
    let nowMs = 0;
    render(<Probe now={() => nowMs} onState={() => {}} />);

    act(() => {
      nowMs = 60_000;
      vi.advanceTimersByTime(1000);
    });

    expect(useGameStore.getState().phase).toBe("reveal");
  });

  it("stops returning a value once we transition to reveal", () => {
    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, timerMs: 60_000 },
      guessingStartedAt: 1000,
    });
    let last: number | null | undefined;
    const { rerender } = render(<Probe now={() => 1500} onState={(v) => (last = v)} />);
    expect(last).toBe(59_500);

    act(() => {
      useGameStore.setState({ phase: "reveal", guessingStartedAt: null });
    });

    rerender(<Probe now={() => 1500} onState={(v) => (last = v)} />);
    expect(last).toBeNull();
  });
});

describe("useGuessingTimer — activePhases", () => {
  it("activates on the phases passed in activePhases (Ouzbek P2)", () => {
    useGameStore.setState({
      phase: "guessingP2",
      mode: "ouzbek",
      challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      guessingStartedAt: 0,
    });
    let last: number | null | undefined;
    function P2Probe({
      now,
      onState,
    }: {
      now: () => number;
      onState: (ms: number | null) => void;
    }) {
      const { remainingMs } = useGuessingTimer({
        now,
        activePhases: new Set(["guessingP2"]),
      });
      onState(remainingMs);
      return null;
    }
    render(<P2Probe now={() => 5000} onState={(v) => (last = v)} />);
    expect(last).toBe(55_000);
  });

  it("returns null when in a non-active phase even with timer set", () => {
    useGameStore.setState({
      phase: "guessing",
      challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      guessingStartedAt: 0,
    });
    let last: number | null | undefined;
    function P2Only({ now, onState }: { now: () => number; onState: (ms: number | null) => void }) {
      const { remainingMs } = useGuessingTimer({
        now,
        activePhases: new Set(["guessingP2"]),
      });
      onState(remainingMs);
      return null;
    }
    render(<P2Only now={() => 5000} onState={(v) => (last = v)} />);
    expect(last).toBeNull();
  });

  it("forces P2 → handoffP3 when the timer expires (via forceReveal store routing)", () => {
    useGameStore.setState({
      phase: "guessingP2",
      mode: "ouzbek",
      ouzbekRecordingP1: fakeRecording,
      challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      guessingStartedAt: 0,
    });
    let nowMs = 0;
    function P2Probe({ now }: { now: () => number }) {
      useGuessingTimer({ now, activePhases: new Set(["guessingP2"]) });
      return null;
    }
    render(<P2Probe now={() => nowMs} />);
    expect(useGameStore.getState().phase).toBe("guessingP2");

    act(() => {
      nowMs = 60_000;
      vi.advanceTimersByTime(1000);
    });

    expect(useGameStore.getState().phase).toBe("handoffP3");
    expect(useGameStore.getState().guessingStartedAt).toBeNull();
  });

  it("forces P4 → revealOuzbek when the timer expires", () => {
    useGameStore.setState({
      phase: "guessingP4",
      mode: "ouzbek",
      ouzbekRecordingP3: fakeRecording,
      challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      guessingStartedAt: 0,
    });
    let nowMs = 0;
    function P4Probe({ now }: { now: () => number }) {
      useGuessingTimer({ now, activePhases: new Set(["guessingP4"]) });
      return null;
    }
    render(<P4Probe now={() => nowMs} />);
    expect(useGameStore.getState().phase).toBe("guessingP4");

    act(() => {
      nowMs = 60_000;
      vi.advanceTimersByTime(1000);
    });

    expect(useGameStore.getState().phase).toBe("revealOuzbek");
  });
});

describe("formatRemaining", () => {
  it("formats a one-minute timer as 1:00", () => {
    expect(formatRemaining(60_000)).toBe("1:00");
  });

  it("formats sub-minute as 0:SS, rounding up partial seconds", () => {
    expect(formatRemaining(59_500)).toBe("1:00");
    expect(formatRemaining(58_999)).toBe("0:59");
    expect(formatRemaining(1)).toBe("0:01");
    expect(formatRemaining(0)).toBe("0:00");
  });

  it("zero-pads seconds < 10", () => {
    expect(formatRemaining(63_000)).toBe("1:03");
  });
});
