import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  loadPersistedState,
  savePersistedState,
  clearPersistedState,
  type PersistedState,
} from "./persistence";

function makeState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    phase: "guessing",
    originalRecording: { blob: new Blob(["abc"], { type: "audio/webm" }), durationMs: 500 },
    guessRecording: null,
    notes: "",
    listenCount: 0,
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    // Wipe between tests so DBs don't leak state.
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns null when nothing has been persisted", async () => {
    expect(await loadPersistedState()).toBeNull();
  });

  it("saves and reloads a full state, preserving blob bytes", async () => {
    const state = makeState({ notes: "hypothèse", listenCount: 3 });
    await savePersistedState(state);
    const loaded = await loadPersistedState();
    expect(loaded).not.toBeNull();
    expect(loaded?.phase).toBe("guessing");
    expect(loaded?.notes).toBe("hypothèse");
    expect(loaded?.listenCount).toBe(3);
    expect(loaded?.originalRecording?.durationMs).toBe(500);

    const blob = loaded?.originalRecording?.blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob?.text()).toBe("abc");
  });

  it("overwrites a previous save", async () => {
    await savePersistedState(makeState({ notes: "first" }));
    await savePersistedState(makeState({ notes: "second" }));
    const loaded = await loadPersistedState();
    expect(loaded?.notes).toBe("second");
  });

  it("clears persisted state", async () => {
    await savePersistedState(makeState());
    await clearPersistedState();
    expect(await loadPersistedState()).toBeNull();
  });

  it("persists guessRecording alongside originalRecording", async () => {
    const state = makeState({
      guessRecording: { blob: new Blob(["xyz"]), durationMs: 200 },
    });
    await savePersistedState(state);
    const loaded = await loadPersistedState();
    expect(loaded?.guessRecording?.durationMs).toBe(200);
    expect(await loaded?.guessRecording?.blob.text()).toBe("xyz");
  });
});
