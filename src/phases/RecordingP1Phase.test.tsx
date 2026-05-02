import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingP1Phase } from "./RecordingP1Phase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "recordingP1", mode: "ouzbek" });
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

function renderPhase() {
  const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
  const recorder = makeFakeRecorder(blob);
  const player = makeFakePlayer();
  render(
    <RecordingP1Phase
      audioContextFactory={() => ({}) as AudioContext}
      recorderFactory={vi.fn((_opts: RecorderOptions) => recorder)}
      playerFactory={vi.fn(() => player)}
      decode={vi.fn(async () => fakeForward)}
      reverse={vi.fn(() => fakeReversed)}
    />,
  );
  return { recorder, player };
}

describe("<RecordingP1Phase />", () => {
  it("renders the J1 privacy title before recording", () => {
    renderPhase();
    expect(
      screen.getByRole("heading", { name: /enregistre ton vocal sans que personne ne t'écoute/i }),
    ).toBeInTheDocument();
  });

  it("records and dispatches finishRecordingP1 on continue, transitioning to handoffP2", async () => {
    const user = userEvent.setup();
    renderPhase();

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    await user.click(await screen.findByRole("button", { name: /arrêter/i }));
    await user.click(await screen.findByRole("button", { name: /passer au joueur 2/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("handoffP2");
    expect(s.ouzbekRecordingP1).not.toBeNull();
    expect(s.ouzbekRecordingP1?.forward).toBe(fakeForward);
  });

  describe("Thème (issue #39)", () => {
    it("renders an optional thème input next to the recording controls", () => {
      renderPhase();
      const input = screen.getByLabelText(/thème/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("maxLength", "30");
    });

    it("typing into the thème input writes ouzbekThemeP1 to the store", async () => {
      const user = userEvent.setup();
      renderPhase();
      await user.type(screen.getByLabelText(/thème/i), "voyage");
      expect(useGameStore.getState().ouzbekThemeP1).toBe("voyage");
    });

    it("keeps the thème editable on the pré-écoute view", async () => {
      const user = userEvent.setup();
      renderPhase();
      await user.click(screen.getByRole("button", { name: /enregistrer/i }));
      await user.click(await screen.findByRole("button", { name: /arrêter/i }));
      // pré-écoute view
      expect(await screen.findByRole("heading", { name: /pré-écoute/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/thème/i)).toBeInTheDocument();
    });
  });
});
