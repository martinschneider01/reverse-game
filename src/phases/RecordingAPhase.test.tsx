import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingAPhase } from "./RecordingAPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "recordingA" });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

function makeFakeRecorder(blob: Blob): Recorder {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => blob),
    cancel: vi.fn(),
    getStream: vi.fn(() => null),
  };
}

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

const fakeForward = {
  length: 24000,
  sampleRate: 48000,
  numberOfChannels: 1,
} as unknown as AudioBuffer;
const fakeReversed = {
  length: 24000,
  sampleRate: 48000,
  numberOfChannels: 1,
} as unknown as AudioBuffer;

function renderPhase(overrides: { recorder?: Recorder; player?: Player } = {}) {
  const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
  const recorder = overrides.recorder ?? makeFakeRecorder(blob);
  const player = overrides.player ?? makeFakePlayer();
  const recorderFactory = vi.fn((_opts: RecorderOptions) => recorder);
  const playerFactory = vi.fn(() => player);

  render(
    <RecordingAPhase
      audioContextFactory={() => ({}) as AudioContext}
      recorderFactory={recorderFactory}
      playerFactory={playerFactory}
      decode={vi.fn(async () => fakeForward)}
      reverse={vi.fn(() => fakeReversed)}
    />,
  );

  return { recorder, player, recorderFactory, playerFactory };
}

async function recordOnce(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /enregistrer/i }));
  await user.click(await screen.findByRole("button", { name: /arrêter/i }));
}

describe("<RecordingAPhase />", () => {
  it("renders the new explicit privacy title before recording", () => {
    renderPhase();
    expect(
      screen.getByRole("heading", { name: /enregistre ton vocal sans que personne ne t'écoute/i }),
    ).toBeInTheDocument();
  });

  it("shows the preview panel with no Refaire button after stop (X on the player resets instead)", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);

    expect(await screen.findByRole("heading", { name: /pré-écoute/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^refaire$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fermer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /passer au joueur 2/i })).toBeInTheDocument();
    expect(useGameStore.getState().phase).toBe("recordingA");
    expect(useGameStore.getState().originalRecording).toBeNull();
  });

  it("clicking 'Passer au Joueur 2' transitions to guessing with the recorded buffer", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);
    await user.click(await screen.findByRole("button", { name: /passer au joueur 2/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("guessing");
    expect(s.originalRecording).toEqual({
      forward: fakeForward,
      reverse: fakeReversed,
      durationMs: 500,
      blob: expect.any(Blob),
    });
  });

  it("clicking the close × on the preview player returns to the recorder without transitioning the store", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);
    expect(await screen.findByRole("button", { name: /fermer/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /fermer/i }));

    expect(await screen.findByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /passer au joueur 2/i })).not.toBeInTheDocument();
    expect(useGameStore.getState().phase).toBe("recordingA");
    expect(useGameStore.getState().originalRecording).toBeNull();
  });
});
