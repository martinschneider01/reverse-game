import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, INITIAL_STATE } from "./gameStore";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
};

function reset(): void {
  useGameStore.setState({ ...INITIAL_STATE });
}

describe("gameStore", () => {
  beforeEach(reset);

  describe("initial state", () => {
    it("starts in the menu phase with empty recordings and notes", () => {
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
    });
  });

  describe("startGame", () => {
    it("transitions menu → permission", () => {
      useGameStore.getState().startGame();
      expect(useGameStore.getState().phase).toBe("permission");
    });

    it("is a no-op when phase is not menu", () => {
      useGameStore.setState({ phase: "handoffA" });
      useGameStore.getState().startGame();
      expect(useGameStore.getState().phase).toBe("handoffA");
    });
  });

  describe("permissionGranted", () => {
    it("transitions permission → handoffA", () => {
      useGameStore.setState({ phase: "permission" });
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("handoffA");
    });

    it("is a no-op when phase is not permission", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("permissionDenied", () => {
    it("transitions permission → permissionDenied", () => {
      useGameStore.setState({ phase: "permission" });
      useGameStore.getState().permissionDenied();
      expect(useGameStore.getState().phase).toBe("permissionDenied");
    });

    it("is a no-op when phase is not permission", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().permissionDenied();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("retryPermission", () => {
    it("transitions permissionDenied → permission", () => {
      useGameStore.setState({ phase: "permissionDenied" });
      useGameStore.getState().retryPermission();
      expect(useGameStore.getState().phase).toBe("permission");
    });

    it("is a no-op when phase is not permissionDenied", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().retryPermission();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("confirmHandoffA", () => {
    it("transitions handoffA → recordingA", () => {
      useGameStore.setState({ phase: "handoffA" });
      useGameStore.getState().confirmHandoffA();
      expect(useGameStore.getState().phase).toBe("recordingA");
    });

    it("is a no-op when phase is not handoffA", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().confirmHandoffA();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("finishRecordingA", () => {
    it("stores the recording and transitions recordingA → done", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("done");
      expect(s.originalRecording).toBe(fakeRecording);
    });

    it("is a no-op when phase is not recordingA", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
    });
  });

  describe("backToMenu", () => {
    it("resets to the initial state from any non-menu phase", () => {
      useGameStore.setState({
        phase: "done",
        originalRecording: fakeRecording,
        guessRecording: fakeRecording,
        notes: "scribbles",
      });
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
    });

    it("is idempotent when already in menu", () => {
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
    });
  });

  describe("end-to-end happy path through implemented phases", () => {
    it("walks menu → permission → handoffA → recordingA → done", () => {
      const store = useGameStore.getState();
      store.startGame();
      expect(useGameStore.getState().phase).toBe("permission");
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("handoffA");
      useGameStore.getState().confirmHandoffA();
      expect(useGameStore.getState().phase).toBe("recordingA");
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("done");
      expect(s.originalRecording).toBe(fakeRecording);
    });

    it("walks menu → permission → permissionDenied → permission via retry", () => {
      useGameStore.getState().startGame();
      useGameStore.getState().permissionDenied();
      expect(useGameStore.getState().phase).toBe("permissionDenied");
      useGameStore.getState().retryPermission();
      expect(useGameStore.getState().phase).toBe("permission");
    });
  });
});
