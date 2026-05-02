import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, INITIAL_STATE, type ChallengeRules } from "./gameStore";
import type { Recording } from "@/audio/recording";

const sampleRules: ChallengeRules = {
  timerMs: 60_000,
  notesEnabled: false,
  listenLimit: 3,
};

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  gain: 1,
  blob: new Blob(),
};

const otherRecording: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
  gain: 1,
  blob: new Blob(),
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
      expect(s.challengeRules).toBeNull();
    });
  });

  describe("startChallenge", () => {
    it("transitions menu → challengeConfig", () => {
      useGameStore.getState().startChallenge();
      expect(useGameStore.getState().phase).toBe("challengeConfig");
    });

    it("does not write challengeRules — that's confirmChallengeRules' job", () => {
      useGameStore.getState().startChallenge();
      expect(useGameStore.getState().challengeRules).toBeNull();
    });

    it("is a no-op when phase is not menu", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().startChallenge();
      expect(useGameStore.getState().phase).toBe("recordingA");
    });
  });

  describe("confirmChallengeRules", () => {
    it("transitions challengeConfig → permission and stores the rules", () => {
      useGameStore.setState({ phase: "challengeConfig" });
      useGameStore.getState().confirmChallengeRules(sampleRules);
      const s = useGameStore.getState();
      expect(s.phase).toBe("permission");
      expect(s.challengeRules).toEqual(sampleRules);
    });

    it("is a no-op when phase is not challengeConfig", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().confirmChallengeRules(sampleRules);
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.challengeRules).toBeNull();
    });
  });

  describe("startGame", () => {
    it("transitions menu → permission", () => {
      useGameStore.getState().startGame();
      expect(useGameStore.getState().phase).toBe("permission");
    });

    it("is a no-op when phase is not menu", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().startGame();
      expect(useGameStore.getState().phase).toBe("recordingA");
    });
  });

  describe("permissionGranted", () => {
    it("transitions permission → recordingA", () => {
      useGameStore.setState({ phase: "permission" });
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("recordingA");
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

  describe("finishRecordingA", () => {
    it("stores the recording and transitions recordingA → guessing", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessing");
      expect(s.originalRecording).toBe(fakeRecording);
    });

    it("is a no-op when phase is not recordingA", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
    });

    it("sets guessingStartedAt to now when challengeRules carries a timer", () => {
      const t0 = Date.now();
      useGameStore.setState({
        phase: "recordingA",
        challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      });
      useGameStore.getState().finishRecordingA(fakeRecording);
      const s = useGameStore.getState();
      expect(s.guessingStartedAt).not.toBeNull();
      expect(s.guessingStartedAt!).toBeGreaterThanOrEqual(t0);
    });

    it("leaves guessingStartedAt null when there are no rules (Mode 1)", () => {
      useGameStore.setState({ phase: "recordingA", challengeRules: null });
      useGameStore.getState().finishRecordingA(fakeRecording);
      expect(useGameStore.getState().guessingStartedAt).toBeNull();
    });

    it("leaves guessingStartedAt null when challengeRules.timerMs is null", () => {
      useGameStore.setState({
        phase: "recordingA",
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
      });
      useGameStore.getState().finishRecordingA(fakeRecording);
      expect(useGameStore.getState().guessingStartedAt).toBeNull();
    });
  });

  describe("forceReveal", () => {
    it("transitions guessing → reveal and clears guessingStartedAt", () => {
      useGameStore.setState({
        phase: "guessing",
        originalRecording: fakeRecording,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().forceReveal();
      const s = useGameStore.getState();
      expect(s.phase).toBe("reveal");
      expect(s.guessingStartedAt).toBeNull();
    });

    it("transitions confirmEnd → reveal too (skipping the confirmation modal)", () => {
      useGameStore.setState({
        phase: "confirmEnd",
        originalRecording: fakeRecording,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().forceReveal();
      expect(useGameStore.getState().phase).toBe("reveal");
    });

    it("is a no-op outside guessing | confirmEnd", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().forceReveal();
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

    it("clears the guess recording when called with null", () => {
      useGameStore.setState({ phase: "guessing", guessRecording: fakeRecording });
      useGameStore.getState().setGuessRecording(null);
      expect(useGameStore.getState().guessRecording).toBeNull();
    });

    it("is a no-op outside the guessing phase", () => {
      useGameStore.setState({ phase: "recordingA", guessRecording: null });
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

  describe("newRound", () => {
    it("transitions reveal → recordingA and resets per-round slices", () => {
      useGameStore.setState({
        phase: "reveal",
        originalRecording: fakeRecording,
        guessRecording: otherRecording,
        notes: "scribbles",
        listenCount: 4,
      });
      useGameStore.getState().newRound();
      const s = useGameStore.getState();
      expect(s.phase).toBe("recordingA");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
    });

    it("preserves challengeRules — chaining rounds in Mode Challenge keeps the same config", () => {
      useGameStore.setState({
        phase: "reveal",
        originalRecording: fakeRecording,
        challengeRules: sampleRules,
      });
      useGameStore.getState().newRound();
      expect(useGameStore.getState().challengeRules).toEqual(sampleRules);
    });

    it("is a no-op outside the reveal phase", () => {
      useGameStore.setState({
        phase: "guessing",
        originalRecording: fakeRecording,
        notes: "wip",
      });
      useGameStore.getState().newRound();
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessing");
      expect(s.originalRecording).toBe(fakeRecording);
      expect(s.notes).toBe("wip");
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
        challengeRules: sampleRules,
      });
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
      expect(s.challengeRules).toBeNull();
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
    it("walks menu → … → reveal without hand-off phases", () => {
      const store = useGameStore.getState();
      store.startGame();
      expect(useGameStore.getState().phase).toBe("permission");
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("recordingA");
      useGameStore.getState().finishRecordingA(fakeRecording);
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
