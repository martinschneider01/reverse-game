import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuessingPhase } from "./GuessingPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recording } from "@/audio/recording";
import type { Player } from "@/audio/wrappers/player";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";

const fakeOriginal: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
};

const fakeGuess: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
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
