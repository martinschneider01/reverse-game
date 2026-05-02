import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuessingPhase } from "./GuessingPhase";
import { useGameStore, INITIAL_STATE, DEFAULT_CHALLENGE_RULES } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recording } from "@/audio/recording";
import type { Player } from "@/audio/wrappers/player";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";

const fakeOriginal: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  blob: new Blob(),
};

const fakeGuess: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
  blob: new Blob(),
};

function makeFakePlayer(): Player {
  return {
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setRate: vi.fn(),
    setDirection: vi.fn(),
    setGain: vi.fn(),
    onEnded: vi.fn(),
  };
}

function makeFakeRecorder(blob: Blob): Recorder {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => blob),
    cancel: vi.fn(),
    getStream: vi.fn(() => null),
  };
}

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "guessing",
    originalRecording: fakeOriginal,
  });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

const audioContextFactory = (): AudioContext => ({}) as AudioContext;

describe("<GuessingPhase />", () => {
  it("renders the original player locked in reverse with the forward button visible but disabled", () => {
    const player = makeFakePlayer();
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={() => player} />,
    );
    expect(player.setDirection).toHaveBeenCalledWith("reverse");
    expect(player.load).toHaveBeenCalledWith(fakeOriginal);
    const forwardBtn = screen.getByRole("button", { name: /lecture à l'endroit/i });
    expect(forwardBtn).toBeDisabled();
    const reverseBtn = screen.getByRole("button", { name: /lecture à l'envers/i });
    expect(reverseBtn).not.toBeDisabled();
  });

  it("clicking 'Fin' transitions to confirmEnd", async () => {
    const user = userEvent.setup();
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.click(screen.getByRole("button", { name: /^fin$/i }));
    expect(useGameStore.getState().phase).toBe("confirmEnd");
  });

  it("typing in the notes editor updates the store notes", async () => {
    const user = userEvent.setup();
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.type(screen.getByRole("textbox", { name: /notes/i }), "x");
    expect(useGameStore.getState().notes).toBe("x");
  });

  it("playing the original increments the listen counter shown in the UI", async () => {
    const user = userEvent.setup();
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 0");
    await user.click(screen.getByRole("button", { name: /lecture à l'envers/i }));
    expect(useGameStore.getState().listenCount).toBe(1);
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 1");
  });

  it("recording overwrites the guess recording in the store and replaces the recorder with a player", async () => {
    const user = userEvent.setup();
    const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const recorder = makeFakeRecorder(blob);
    const recorderFactory = vi.fn((_opts: RecorderOptions) => recorder);

    render(
      <GuessingPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
        recorderFactory={recorderFactory}
        decode={vi.fn(async () => fakeGuess.forward)}
        reverse={vi.fn(() => fakeGuess.reverse)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    await user.click(await screen.findByRole("button", { name: /arrêter/i }));

    await vi.waitFor(() => {
      expect(useGameStore.getState().guessRecording).not.toBeNull();
    });

    expect(screen.queryByRole("button", { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /lecture à l'endroit/i }).length).toBe(2);
  });

  it("clicking the × on the guess preview clears guessRecording and shows the recorder again", async () => {
    const user = userEvent.setup();
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      guessRecording: fakeGuess,
    });

    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );

    expect(screen.getByRole("button", { name: /fermer/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /fermer/i }));

    expect(useGameStore.getState().guessRecording).toBeNull();
    expect(await screen.findByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("renders the notes editor in Mode 1 (challengeRules === null)", () => {
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("textbox", { name: /notes/i })).toBeInTheDocument();
  });

  it("renders the notes editor when challengeRules.notesEnabled is true", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, notesEnabled: true },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("textbox", { name: /notes/i })).toBeInTheDocument();
  });

  it("hides the notes editor when challengeRules.notesEnabled is false", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, notesEnabled: false },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.queryByRole("textbox", { name: /notes/i })).not.toBeInTheDocument();
  });

  it("does not write to store.notes when notesEnabled is false (no editor to type into)", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, notesEnabled: false },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    // No editor means no path for the user to write to notes.
    expect(useGameStore.getState().notes).toBe("");
    expect(screen.queryByRole("textbox", { name: /notes/i })).not.toBeInTheDocument();
  });

  it("shows a plain 'Écoutes : X' counter in Mode 1 (listenLimit === null)", () => {
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 0");
    expect(screen.getByLabelText(/compteur d'écoutes/i).textContent).not.toMatch(/\//);
  });

  it("shows 'Écoutes : X / N' counter when listenLimit is defined", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      listenCount: 1,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, listenLimit: 3 },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 1 / 3");
  });

  it("does not disable the reverse play button while listenCount < listenLimit", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      listenCount: 2,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, listenLimit: 3 },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).not.toBeDisabled();
  });

  it("disables the play button when listenCount >= listenLimit", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      listenCount: 3,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, listenLimit: 3 },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeDisabled();
  });

  it("disables the play button after reaching the limit by clicking play", async () => {
    const user = userEvent.setup();
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      listenCount: 0,
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, listenLimit: 1 },
    });
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    const reverseBtn = screen.getByRole("button", { name: /lecture à l'envers/i });
    expect(reverseBtn).not.toBeDisabled();
    await user.click(reverseBtn);
    expect(useGameStore.getState().listenCount).toBe(1);
    expect(screen.getByRole("button", { name: /pause/i })).toBeDisabled();
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 1 / 1");
  });

  it("the 'Ta voix' replay player does not expose the gear (and slider) while the original does", async () => {
    const user = userEvent.setup();
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      guessRecording: fakeGuess,
    });

    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );

    expect(screen.queryByRole("slider", { name: /vitesse/i })).not.toBeInTheDocument();

    const gears = screen.getAllByRole("button", { name: /réglages vitesse/i });
    expect(gears).toHaveLength(1);

    await user.click(gears[0]!);
    expect(screen.getAllByRole("slider", { name: /vitesse/i })).toHaveLength(1);
  });
});
