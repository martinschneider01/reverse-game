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
  it("shows the preview panel after stop instead of immediately transitioning", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);

    expect(await screen.findByRole("heading", { name: /pré-écoute/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lecture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refaire/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /passer à b/i })).toBeInTheDocument();
    expect(useGameStore.getState().phase).toBe("recordingA");
    expect(useGameStore.getState().originalRecording).toBeNull();
  });

  it("clicking 'Passer à B' transitions to handoffB with the recorded buffer", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);
    await user.click(await screen.findByRole("button", { name: /passer à b/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("handoffB");
    expect(s.originalRecording).toEqual({
      forward: fakeForward,
      reverse: fakeReversed,
      durationMs: 500,
    });
  });

  it("clicking 'Refaire' returns to the recorder without transitioning the store", async () => {
    const user = userEvent.setup();
    renderPhase();

    await recordOnce(user);
    expect(await screen.findByRole("button", { name: /refaire/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /refaire/i }));

    expect(await screen.findByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /passer à b/i })).not.toBeInTheDocument();
    expect(useGameStore.getState().phase).toBe("recordingA");
    expect(useGameStore.getState().originalRecording).toBeNull();
  });
});
