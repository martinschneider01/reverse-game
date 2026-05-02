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
    mode: "mode1",
    originalRecording: { blob: new Blob(["abc"], { type: "audio/webm" }), durationMs: 500 },
    guessRecording: null,
    notes: "",
    listenCount: 0,
    challengeRules: null,
    guessingStartedAt: null,
    ouzbekRecordingP1: null,
    ouzbekNoteP2: "",
    ouzbekRecordingP3: null,
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

  it("round-trips challengeRules so Mode Challenge survives a lock-screen", async () => {
    const state = makeState({
      challengeRules: { timerMs: 60_000, notesEnabled: false, listenLimit: 3 },
    });
    await savePersistedState(state);
    const loaded = await loadPersistedState();
    expect(loaded?.challengeRules).toEqual({
      timerMs: 60_000,
      notesEnabled: false,
      listenLimit: 3,
    });
  });

  it("round-trips guessingStartedAt so the timer resumes after a lock-screen", async () => {
    const startedAt = 1700000000000;
    await savePersistedState(
      makeState({
        challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
        guessingStartedAt: startedAt,
      }),
    );
    const loaded = await loadPersistedState();
    expect(loaded?.guessingStartedAt).toBe(startedAt);
  });

  it("loads guessingStartedAt as null when absent from a pre-timer save", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("reverso", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(
          {
            version: 1,
            phase: "guessing",
            originalRecording: {
              data: new ArrayBuffer(0),
              mimeType: "audio/webm",
              durationMs: 100,
            },
            guessRecording: null,
            notes: "",
            listenCount: 0,
            challengeRules: null,
            // no guessingStartedAt key
          },
          "current",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("seed failed"));
        };
      };
      req.onerror = () => reject(req.error ?? new Error("open failed"));
    });

    const loaded = await loadPersistedState();
    expect(loaded?.guessingStartedAt).toBeNull();
  });

  it("round-trips a full Ouzbek state with all three artefacts", async () => {
    const state = makeState({
      phase: "guessingP4",
      mode: "ouzbek",
      // An Ouzbek save can omit originalRecording; the Ouzbek round
      // is keyed on ouzbekRecordingP1 instead.
      originalRecording: null,
      ouzbekRecordingP1: { blob: new Blob(["P1"], { type: "audio/webm" }), durationMs: 1000 },
      ouzbekNoteP2: "transcription de J2",
      ouzbekRecordingP3: { blob: new Blob(["P3"], { type: "audio/webm" }), durationMs: 800 },
    });
    await savePersistedState(state);
    const loaded = await loadPersistedState();
    expect(loaded?.phase).toBe("guessingP4");
    expect(loaded?.mode).toBe("ouzbek");
    expect(loaded?.originalRecording).toBeNull();
    expect(loaded?.ouzbekRecordingP1?.durationMs).toBe(1000);
    expect(await loaded?.ouzbekRecordingP1?.blob.text()).toBe("P1");
    expect(loaded?.ouzbekNoteP2).toBe("transcription de J2");
    expect(loaded?.ouzbekRecordingP3?.durationMs).toBe(800);
    expect(await loaded?.ouzbekRecordingP3?.blob.text()).toBe("P3");
  });

  it("loads Ouzbek fields as defaults (mode='mode1', empty/null) on a pre-Ouzbek save", async () => {
    // Simulate a save written before any of the Ouzbek fields existed.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("reverso", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(
          {
            version: 1,
            phase: "guessing",
            originalRecording: {
              data: new ArrayBuffer(0),
              mimeType: "audio/webm",
              durationMs: 100,
            },
            guessRecording: null,
            notes: "",
            listenCount: 0,
            // no mode, no ouzbek* keys
          },
          "current",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("seed failed"));
        };
      };
      req.onerror = () => reject(req.error ?? new Error("open failed"));
    });

    const loaded = await loadPersistedState();
    expect(loaded?.mode).toBe("mode1");
    expect(loaded?.ouzbekRecordingP1).toBeNull();
    expect(loaded?.ouzbekNoteP2).toBe("");
    expect(loaded?.ouzbekRecordingP3).toBeNull();
  });

  it("loads challengeRules as null when absent from a pre-Mode-Challenge save", async () => {
    // Simulate a save written before the challengeRules field existed.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("reverso", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(
          {
            version: 1,
            phase: "guessing",
            originalRecording: {
              data: new ArrayBuffer(0),
              mimeType: "audio/webm",
              durationMs: 100,
            },
            guessRecording: null,
            notes: "",
            listenCount: 0,
            // no challengeRules key
          },
          "current",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("seed failed"));
        };
      };
      req.onerror = () => reject(req.error ?? new Error("open failed"));
    });

    const loaded = await loadPersistedState();
    expect(loaded?.challengeRules).toBeNull();
  });
});
