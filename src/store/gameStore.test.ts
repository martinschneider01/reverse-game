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
      expect(s.mode).toBe("mode1");
      expect(s.originalRecording).toBeNull();
      expect(s.guessRecording).toBeNull();
      expect(s.notes).toBe("");
      expect(s.listenCount).toBe(0);
      expect(s.challengeRules).toBeNull();
      expect(s.ouzbekRecordingP1).toBeNull();
      expect(s.ouzbekThemeP1).toBe("");
      expect(s.ouzbekNoteP2).toBe("");
      expect(s.ouzbekRecordingP3).toBeNull();
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

    it("is a no-op outside guessing | confirmEnd | guessingP2 | guessingP4", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().forceReveal();
      expect(useGameStore.getState().phase).toBe("menu");
    });

    it("transitions guessingP2 → handoffP3 (Ouzbek timer expiry on P2)", () => {
      useGameStore.setState({
        phase: "guessingP2",
        mode: "ouzbek",
        ouzbekRecordingP1: fakeRecording,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().forceReveal();
      const s = useGameStore.getState();
      expect(s.phase).toBe("handoffP3");
      expect(s.guessingStartedAt).toBeNull();
    });

    it("transitions guessingP4 → revealOuzbek (Ouzbek timer expiry on P4)", () => {
      useGameStore.setState({
        phase: "guessingP4",
        mode: "ouzbek",
        ouzbekRecordingP3: fakeRecording,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().forceReveal();
      const s = useGameStore.getState();
      expect(s.phase).toBe("revealOuzbek");
      expect(s.guessingStartedAt).toBeNull();
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

  describe("startOuzbek", () => {
    it("transitions menu → permission and sets mode to ouzbek", () => {
      useGameStore.getState().startOuzbek();
      const s = useGameStore.getState();
      expect(s.phase).toBe("permission");
      expect(s.mode).toBe("ouzbek");
    });

    it("is a no-op when phase is not menu", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().startOuzbek();
      const s = useGameStore.getState();
      expect(s.phase).toBe("recordingA");
      expect(s.mode).toBe("mode1");
    });
  });

  describe("startOuzbekChallenge", () => {
    it("transitions menu → ouzbekChallengeConfig and sets mode to ouzbek", () => {
      useGameStore.getState().startOuzbekChallenge();
      const s = useGameStore.getState();
      expect(s.phase).toBe("ouzbekChallengeConfig");
      expect(s.mode).toBe("ouzbek");
    });

    it("does not write challengeRules — that's confirmChallengeRules' job", () => {
      useGameStore.getState().startOuzbekChallenge();
      expect(useGameStore.getState().challengeRules).toBeNull();
    });

    it("is a no-op when phase is not menu", () => {
      useGameStore.setState({ phase: "recordingA" });
      useGameStore.getState().startOuzbekChallenge();
      const s = useGameStore.getState();
      expect(s.phase).toBe("recordingA");
      expect(s.mode).toBe("mode1");
    });
  });

  describe("confirmChallengeRules — Ouzbek path", () => {
    it("transitions ouzbekChallengeConfig → permission and stores the rules", () => {
      useGameStore.setState({ phase: "ouzbekChallengeConfig", mode: "ouzbek" });
      useGameStore.getState().confirmChallengeRules(sampleRules);
      const s = useGameStore.getState();
      expect(s.phase).toBe("permission");
      expect(s.mode).toBe("ouzbek");
      expect(s.challengeRules).toEqual(sampleRules);
    });
  });

  describe("startGame / startChallenge — mode reset", () => {
    it("startGame sets mode to mode1 (covers menu re-entry after Ouzbek)", () => {
      useGameStore.setState({ phase: "menu", mode: "ouzbek" });
      useGameStore.getState().startGame();
      const s = useGameStore.getState();
      expect(s.phase).toBe("permission");
      expect(s.mode).toBe("mode1");
    });

    it("startChallenge sets mode to mode1", () => {
      useGameStore.setState({ phase: "menu", mode: "ouzbek" });
      useGameStore.getState().startChallenge();
      const s = useGameStore.getState();
      expect(s.phase).toBe("challengeConfig");
      expect(s.mode).toBe("mode1");
    });
  });

  describe("permissionGranted — mode-aware routing", () => {
    it("routes permission → recordingA when mode is mode1", () => {
      useGameStore.setState({ phase: "permission", mode: "mode1" });
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("recordingA");
    });

    it("routes permission → recordingP1 when mode is ouzbek", () => {
      useGameStore.setState({ phase: "permission", mode: "ouzbek" });
      useGameStore.getState().permissionGranted();
      expect(useGameStore.getState().phase).toBe("recordingP1");
    });
  });

  describe("Ouzbek phase actions", () => {
    it("finishRecordingP1 stores the recording and transitions recordingP1 → handoffP2", () => {
      useGameStore.setState({ phase: "recordingP1", mode: "ouzbek" });
      useGameStore.getState().finishRecordingP1(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("handoffP2");
      expect(s.ouzbekRecordingP1).toBe(fakeRecording);
    });

    it("finishRecordingP1 is a no-op outside recordingP1", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().finishRecordingP1(fakeRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.ouzbekRecordingP1).toBeNull();
    });

    it("startGuessingP2 transitions handoffP2 → guessingP2", () => {
      useGameStore.setState({ phase: "handoffP2", mode: "ouzbek" });
      useGameStore.getState().startGuessingP2();
      expect(useGameStore.getState().phase).toBe("guessingP2");
    });

    it("startGuessingP2 is a no-op outside handoffP2", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().startGuessingP2();
      expect(useGameStore.getState().phase).toBe("menu");
    });

    it("startGuessingP2 sets guessingStartedAt when challengeRules carries a timer", () => {
      const t0 = Date.now();
      useGameStore.setState({
        phase: "handoffP2",
        mode: "ouzbek",
        challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      });
      useGameStore.getState().startGuessingP2();
      const s = useGameStore.getState();
      expect(s.guessingStartedAt).not.toBeNull();
      expect(s.guessingStartedAt!).toBeGreaterThanOrEqual(t0);
    });

    it("startGuessingP2 leaves guessingStartedAt null without a timer rule", () => {
      useGameStore.setState({ phase: "handoffP2", mode: "ouzbek", challengeRules: null });
      useGameStore.getState().startGuessingP2();
      expect(useGameStore.getState().guessingStartedAt).toBeNull();
    });

    it("setOuzbekThemeP1 writes when in recordingP1", () => {
      useGameStore.setState({ phase: "recordingP1", mode: "ouzbek" });
      useGameStore.getState().setOuzbekThemeP1("voyage");
      expect(useGameStore.getState().ouzbekThemeP1).toBe("voyage");
    });

    it("setOuzbekThemeP1 is a no-op outside recordingP1", () => {
      useGameStore.setState({ phase: "guessingP2", ouzbekThemeP1: "" });
      useGameStore.getState().setOuzbekThemeP1("nope");
      expect(useGameStore.getState().ouzbekThemeP1).toBe("");
    });

    it("setOuzbekNoteP2 writes when in guessingP2", () => {
      useGameStore.setState({ phase: "guessingP2", mode: "ouzbek" });
      useGameStore.getState().setOuzbekNoteP2("ma transcription");
      expect(useGameStore.getState().ouzbekNoteP2).toBe("ma transcription");
    });

    it("setOuzbekNoteP2 is a no-op outside guessingP2", () => {
      useGameStore.setState({ phase: "handoffP2", ouzbekNoteP2: "" });
      useGameStore.getState().setOuzbekNoteP2("nope");
      expect(useGameStore.getState().ouzbekNoteP2).toBe("");
    });

    it("finishGuessingP2 transitions guessingP2 → handoffP3 and preserves the note", () => {
      useGameStore.setState({
        phase: "guessingP2",
        mode: "ouzbek",
        ouzbekNoteP2: "transcription",
      });
      useGameStore.getState().finishGuessingP2();
      const s = useGameStore.getState();
      expect(s.phase).toBe("handoffP3");
      expect(s.ouzbekNoteP2).toBe("transcription");
    });

    it("finishGuessingP2 resets listenCount and guessingStartedAt so P4 starts fresh", () => {
      useGameStore.setState({
        phase: "guessingP2",
        mode: "ouzbek",
        listenCount: 4,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().finishGuessingP2();
      const s = useGameStore.getState();
      expect(s.listenCount).toBe(0);
      expect(s.guessingStartedAt).toBeNull();
    });

    it("startGuessingP4 sets guessingStartedAt when challengeRules carries a timer", () => {
      const t0 = Date.now();
      useGameStore.setState({
        phase: "handoffP4",
        mode: "ouzbek",
        challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
      });
      useGameStore.getState().startGuessingP4();
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessingP4");
      expect(s.guessingStartedAt).not.toBeNull();
      expect(s.guessingStartedAt!).toBeGreaterThanOrEqual(t0);
    });

    it("revealOuzbekChain clears guessingStartedAt", () => {
      useGameStore.setState({
        phase: "guessingP4",
        mode: "ouzbek",
        guessingStartedAt: 1234,
      });
      useGameStore.getState().revealOuzbekChain();
      expect(useGameStore.getState().guessingStartedAt).toBeNull();
    });

    it("startRecordingP3 transitions handoffP3 → recordingP3", () => {
      useGameStore.setState({ phase: "handoffP3", mode: "ouzbek" });
      useGameStore.getState().startRecordingP3();
      expect(useGameStore.getState().phase).toBe("recordingP3");
    });

    it("finishRecordingP3 stores and transitions recordingP3 → handoffP4", () => {
      useGameStore.setState({ phase: "recordingP3", mode: "ouzbek" });
      useGameStore.getState().finishRecordingP3(otherRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("handoffP4");
      expect(s.ouzbekRecordingP3).toBe(otherRecording);
    });

    it("finishRecordingP3 is a no-op outside recordingP3", () => {
      useGameStore.setState({ phase: "guessingP2" });
      useGameStore.getState().finishRecordingP3(otherRecording);
      const s = useGameStore.getState();
      expect(s.phase).toBe("guessingP2");
      expect(s.ouzbekRecordingP3).toBeNull();
    });

    it("startGuessingP4 transitions handoffP4 → guessingP4", () => {
      useGameStore.setState({ phase: "handoffP4", mode: "ouzbek" });
      useGameStore.getState().startGuessingP4();
      expect(useGameStore.getState().phase).toBe("guessingP4");
    });

    it("revealOuzbekChain transitions guessingP4 → revealOuzbek", () => {
      useGameStore.setState({ phase: "guessingP4", mode: "ouzbek" });
      useGameStore.getState().revealOuzbekChain();
      expect(useGameStore.getState().phase).toBe("revealOuzbek");
    });

    it("revealOuzbekChain is a no-op outside guessingP4", () => {
      useGameStore.setState({ phase: "menu" });
      useGameStore.getState().revealOuzbekChain();
      expect(useGameStore.getState().phase).toBe("menu");
    });

    it("newOuzbekRound clears Ouzbek artefacts and transitions revealOuzbek → recordingP1", () => {
      useGameStore.setState({
        phase: "revealOuzbek",
        mode: "ouzbek",
        ouzbekRecordingP1: fakeRecording,
        ouzbekThemeP1: "voyage",
        ouzbekNoteP2: "scribbles",
        ouzbekRecordingP3: otherRecording,
      });
      useGameStore.getState().newOuzbekRound();
      const s = useGameStore.getState();
      expect(s.phase).toBe("recordingP1");
      expect(s.mode).toBe("ouzbek");
      expect(s.ouzbekRecordingP1).toBeNull();
      expect(s.ouzbekThemeP1).toBe("");
      expect(s.ouzbekNoteP2).toBe("");
      expect(s.ouzbekRecordingP3).toBeNull();
    });

    it("newOuzbekRound resets listenCount and guessingStartedAt", () => {
      useGameStore.setState({
        phase: "revealOuzbek",
        mode: "ouzbek",
        listenCount: 4,
        guessingStartedAt: 1234,
      });
      useGameStore.getState().newOuzbekRound();
      const s = useGameStore.getState();
      expect(s.listenCount).toBe(0);
      expect(s.guessingStartedAt).toBeNull();
    });

    it("newOuzbekRound preserves challengeRules (chained Ouzbek Challenge rounds)", () => {
      useGameStore.setState({
        phase: "revealOuzbek",
        mode: "ouzbek",
        challengeRules: sampleRules,
      });
      useGameStore.getState().newOuzbekRound();
      expect(useGameStore.getState().challengeRules).toEqual(sampleRules);
    });

    it("newOuzbekRound is a no-op outside revealOuzbek", () => {
      useGameStore.setState({ phase: "guessingP4" });
      useGameStore.getState().newOuzbekRound();
      expect(useGameStore.getState().phase).toBe("guessingP4");
    });

    it("backToMenu resets mode and Ouzbek artefacts", () => {
      useGameStore.setState({
        phase: "guessingP2",
        mode: "ouzbek",
        ouzbekRecordingP1: fakeRecording,
        ouzbekNoteP2: "wip",
        ouzbekRecordingP3: otherRecording,
      });
      useGameStore.getState().backToMenu();
      const s = useGameStore.getState();
      expect(s.phase).toBe("menu");
      expect(s.mode).toBe("mode1");
      expect(s.ouzbekRecordingP1).toBeNull();
      expect(s.ouzbekNoteP2).toBe("");
      expect(s.ouzbekRecordingP3).toBeNull();
    });

    it("backToMenu resets ouzbekThemeP1", () => {
      useGameStore.setState({
        phase: "recordingP1",
        mode: "ouzbek",
        ouzbekThemeP1: "voyage",
      });
      useGameStore.getState().backToMenu();
      expect(useGameStore.getState().ouzbekThemeP1).toBe("");
    });
  });

  describe("Ouzbek end-to-end happy path", () => {
    it("walks menu → permission → recordingP1 → handoffP2 → guessingP2 → handoffP3 → recordingP3 → handoffP4 → guessingP4 → revealOuzbek", () => {
      const store = useGameStore.getState;
      store().startOuzbek();
      expect(store().phase).toBe("permission");
      expect(store().mode).toBe("ouzbek");
      store().permissionGranted();
      expect(store().phase).toBe("recordingP1");
      store().finishRecordingP1(fakeRecording);
      expect(store().phase).toBe("handoffP2");
      expect(store().ouzbekRecordingP1).toBe(fakeRecording);
      store().startGuessingP2();
      expect(store().phase).toBe("guessingP2");
      store().setOuzbekNoteP2("ce que j'entends");
      store().finishGuessingP2();
      expect(store().phase).toBe("handoffP3");
      expect(store().ouzbekNoteP2).toBe("ce que j'entends");
      store().startRecordingP3();
      expect(store().phase).toBe("recordingP3");
      store().finishRecordingP3(otherRecording);
      expect(store().phase).toBe("handoffP4");
      expect(store().ouzbekRecordingP3).toBe(otherRecording);
      store().startGuessingP4();
      expect(store().phase).toBe("guessingP4");
      store().revealOuzbekChain();
      const s = store();
      expect(s.phase).toBe("revealOuzbek");
      expect(s.ouzbekRecordingP1).toBe(fakeRecording);
      expect(s.ouzbekNoteP2).toBe("ce que j'entends");
      expect(s.ouzbekRecordingP3).toBe(otherRecording);
    });
  });
});
