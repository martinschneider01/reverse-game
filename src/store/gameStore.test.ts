import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, INITIAL_STATE } from "./gameStore";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
};

const otherRecording: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
};

function reset(): void {
  useGameStore.setState({ ...INITIAL_STATE });
}

describe("gameStore", () => {
  beforeEach(reset);

  describe("initial state", () => {
    it("starts in the menu phase with empty recordings, notes and listen counter", () => {
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
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
    it("stores the recording and transitions recordingA → handoffB", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("handoffB");
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

  describe("confirmHandoffB", () => {
    it("transitions handoffB → guessing", () => {
      useGameStore.setState({ phase: "handoffB" });
      useGameStore.getState().confirmHandoffB();
      expect(useGameStore.getState().phase).toBe("guessing");
    });

    it("is a no-op when phase is not handoffB", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().confirmHandoffB();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("setNotes", () => {
    it("updates notes when in guessing phase", () => {
      useGameStore.setState({ phase: "guessing" });
      useGameStore.getState().setNotes("bonjour les amis");
      expect(useGameStore.getState().notes).toBe("bonjour les amis");
    });

    it("is a no-op outside the guessing phase", () => {
      useGameStore.setState({ phase: "menu", notes: "" });
      useGameStore.getState().setNotes("nope");
      expect(useGameStore.getState().notes).toBe("");
    });
  });

  describe("setGuessRecording", () => {
    it("stores the recording when in guessing phase", () => {
      useGameStore.setState({ phase: "guessing" });
      useGameStore.getState().setGuessRecording(fakeRecording);
      expect(useGameStore.getState().guessRecording).toBe(fakeRecording);
    });

    it("overwrites the previous guess recording", () => {
      useGameStore.setState({ phase: "guessing", guessRecording: fakeRecording });
      useGameStore.getState().setGuessRecording(otherRecording);
      expect(useGameStore.getState().guessRecording).toBe(otherRecording);
    });

    it("is a no-op outside the guessing phase", () => {
      useGameStore.setState({ phase: "handoffB", guessRecording: null });
      useGameStore.getState().setGuessRecording(fakeRecording);
      expect(useGameStore.getState().guessRecording).toBeNull();
    });
  });

  describe("incrementListenCount", () => {
    it("increments the listen counter", () => {
      useGameStore.getState().incrementListenCount();
      useGameStore.getState().incrementListenCount();
      expect(useGameStore.getState().listenCount).toBe(2);
    });
  });

  describe("endGuessing", () => {
    it("transitions guessing → confirmEnd", () => {
      useGameStore.setState({ phase: "guessing" });
      useGameStore.getState().endGuessing();
      expect(useGameStore.getState().phase).toBe("confirmEnd");
    });

    it("is a no-op outside the guessing phase", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().endGuessing();
      expect(useGameStore.getState().phase).toBe("menu");
    });
  });

  describe("cancelEnd", () => {
    it("transitions confirmEnd → guessing without losing notes / guess / counter", () => {
      useGameStore.setState({
        phase: "confirmEnd",
        notes: "ideas",
        guessRecording: fakeRecording,
        listenCount: 3,
      });
      useGameStore.getState().cancelEnd();
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessing");
      expect(s.notes).toBe("ideas");
      expect(s.guessRecording).toBe(fakeRecording);
      expect(s.listenCount).toBe(3);
    });

    it("is a no-op outside the confirmEnd phase", () => {
      useGameStore.setState({ phase: "guessing" });
      useGameStore.getState().cancelEnd();
      expect(useGameStore.getState().phase).toBe("guessing");
    });
  });

  describe("confirmEnd", () => {
    it("transitions confirmEnd → reveal", () => {
      useGameStore.setState({ phase: "confirmEnd" });
      useGameStore.getState().confirmEnd();
      expect(useGameStore.getState().phase).toBe("reveal");
    });

    it("is a no-op outside the confirmEnd phase", () => {
      useGameStore.setState({ phase: "guessing" });
      useGameStore.getState().confirmEnd();
      expect(useGameStore.getState().phase).toBe("guessing");
    });
  });

  describe("backToMenu", () => {
    it("resets every slice from any non-menu phase", () => {
      useGameStore.setState({
        phase: "reveal",
        originalRecording: fakeRecording,
        guessRecording: fakeRecording,
        notes: "scribbles",
        listenCount: 5,
      });
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
    });

    it("is idempotent when already in menu", () => {
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
    });
  });

  describe("end-to-end happy path", () => {
    it("walks menu → … → reveal", () => {
      const store = useGameStore.getState();
      store.startGame();
      expect(useGameStore.getState().phase).toBe("permission");
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("handoffA");
      useGameStore.getState().confirmHandoffA();
      expect(useGameStore.getState().phase).toBe("recordingA");
      useGameStore.getState().finishRecordingA(fakeRecording);
      expect(useGameStore.getState().phase).toBe("handoffB");
      useGameStore.getState().confirmHandoffB();
      expect(useGameStore.getState().phase).toBe("guessing");
      useGameStore.getState().setNotes("hypothèse");
      useGameStore.getState().setGuessRecording(otherRecording);
      useGameStore.getState().endGuessing();
      expect(useGameStore.getState().phase).toBe("confirmEnd");
      useGameStore.getState().confirmEnd();
      const s = useGameStore.getState();
      expect(s.phase).toBe("reveal");
      expect(s.originalRecording).toBe(fakeRecording);
      expect(s.guessRecording).toBe(otherRecording);
      expect(s.notes).toBe("hypothèse");
    });

    it("walks menu → permission → permissionDenied → permission via retry", () => {
      useGameStore.getState().startGame();
      useGameStore.getState().permissionDenied();
      expect(useGameStore.getState().phase).toBe("permissionDenied");
      useGameStore.getState().retryPermission();
      expect(useGameStore.getState().phase).toBe("permission");
    });

    it("cancels the end-of-round confirmation and resumes guessing", () => {
      useGameStore.setState({
        phase: "guessing",
        notes: "wip",
        guessRecording: fakeRecording,
        listenCount: 2,
      });
      useGameStore.getState().endGuessing();
      expect(useGameStore.getState().phase).toBe("confirmEnd");
      useGameStore.getState().cancelEnd();
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessing");
      expect(s.notes).toBe("wip");
      expect(s.guessRecording).toBe(fakeRecording);
      expect(s.listenCount).toBe(2);
    });
  });
});
