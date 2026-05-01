import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore, INITIAL_STATE } from "./gameStore";
import { startGameStorePersistence } from "./persistGameStore";
import type { PersistedState } from "./persistence";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  blob: new Blob(["audio"], { type: "audio/webm" }),
};

const fakeGuess: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
  blob: new Blob(["guess"], { type: "audio/webm" }),
};

describe("startGameStorePersistence", () => {
  beforeEach(() => {
    useGameStore.setState({ ...INITIAL_STATE });
    vi.useFakeTimers();
  });

  it("saves a snapshot when phase becomes guessing with a recording", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const clear = vi.fn(async () => {});
    const stop = startGameStorePersistence({ debounceMs: 10, save, clear });

    useGameStore.setState({ phase: "guessing", originalRecording: fakeRecording });
    vi.advanceTimersByTime(10);
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      version: 1,
      phase: "guessing",
      notes: "",
      listenCount: 0,
      originalRecording: { blob: fakeRecording.blob, durationMs: 500 },
      guessRecording: null,
    });
    expect(clear).not.toHaveBeenCalled();

    stop();
  });

  it("debounces consecutive updates into a single save", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const stop = startGameStorePersistence({ debounceMs: 50, save, clear: vi.fn() });

    useGameStore.setState({ phase: "guessing", originalRecording: fakeRecording });
    useGameStore.setState({ notes: "a" });
    useGameStore.setState({ notes: "ab" });
    useGameStore.setState({ notes: "abc" });

    vi.advanceTimersByTime(50);
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]?.notes).toBe("abc");

    stop();
  });

  it("clears persisted state when phase is not savable", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const clear = vi.fn(async () => {});
    const stop = startGameStorePersistence({ debounceMs: 5, save, clear });

    useGameStore.setState({ phase: "menu" });
    vi.advanceTimersByTime(5);
    await Promise.resolve();

    expect(save).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(1);

    stop();
  });

  it("clears persisted state when in a savable phase but no original recording yet", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const clear = vi.fn(async () => {});
    const stop = startGameStorePersistence({ debounceMs: 5, save, clear });

    useGameStore.setState({ phase: "guessing", originalRecording: null });
    vi.advanceTimersByTime(5);
    await Promise.resolve();

    expect(save).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(1);

    stop();
  });

  it("includes guessRecording in the snapshot once set", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const stop = startGameStorePersistence({ debounceMs: 5, save, clear: vi.fn() });

    useGameStore.setState({
      phase: "guessing",
      originalRecording: fakeRecording,
      guessRecording: fakeGuess,
    });
    vi.advanceTimersByTime(5);
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]?.guessRecording).toEqual({
      blob: fakeGuess.blob,
      durationMs: 250,
    });

    stop();
  });

  it("stops persisting after the returned unsubscribe is called", async () => {
    const save = vi.fn(async (_state: PersistedState) => {});
    const clear = vi.fn(async () => {});
    const stop = startGameStorePersistence({ debounceMs: 5, save, clear });

    stop();
    useGameStore.setState({ phase: "guessing", originalRecording: fakeRecording });
    vi.advanceTimersByTime(50);
    await Promise.resolve();

    expect(save).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
