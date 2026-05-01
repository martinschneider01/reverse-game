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
  it("renders the original player locked in reverse direction with no direction toggle", () => {
    const player = makeFakePlayer();
    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={() => player} />,
    );
    expect(player.setDirection).toHaveBeenCalledWith("reverse");
    expect(player.load).toHaveBeenCalledWith(fakeOriginal);
    expect(screen.queryByRole("button", { name: /sens/i })).not.toBeInTheDocument();
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
    await user.click(screen.getAllByRole("button", { name: /lecture/i })[0]!);
    expect(useGameStore.getState().listenCount).toBe(1);
    expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent("Écoutes : 1");
  });

  it("recording overwrites the guess recording in the store and reveals a player for it", async () => {
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

    await screen.findAllByRole("button", { name: /lecture/i });
    expect(screen.getAllByRole("button", { name: /lecture/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("the 'Ta voix' replay player does not expose the speed slider while the original does", async () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "guessing",
      originalRecording: fakeOriginal,
      guessRecording: fakeGuess,
    });

    render(
      <GuessingPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );

    const sliders = screen.getAllByRole("slider", { name: /vitesse/i });
    expect(sliders).toHaveLength(1);
  });
});
