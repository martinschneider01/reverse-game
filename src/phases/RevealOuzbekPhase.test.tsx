import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealOuzbekPhase } from "./RevealOuzbekPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recording } from "@/audio/recording";
import type { Player } from "@/audio/wrappers/player";

const fakeP1: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  gain: 1,
  blob: new Blob(),
};

const fakeP3: Recording = {
  forward: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 12000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 250,
  gain: 1,
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

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "revealOuzbek",
    mode: "ouzbek",
    ouzbekRecordingP1: fakeP1,
    ouzbekNoteP2: "transcription par J2",
    ouzbekRecordingP3: fakeP3,
  });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

const audioContextFactory = (): AudioContext => ({}) as AudioContext;

describe("<RevealOuzbekPhase />", () => {
  it("renders the J1 recording, J2 note, and J3 recording", () => {
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    expect(screen.getByRole("heading", { name: /enregistrement de j1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /note de j2/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /enregistrement de j3/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note de j2/i)).toHaveTextContent("transcription par J2");
  });

  it("clicking 'Nouvelle partie' triggers newOuzbekRound", async () => {
    const user = userEvent.setup();
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    await user.click(screen.getByRole("button", { name: /nouvelle partie/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("recordingP1");
    expect(s.mode).toBe("ouzbek");
    expect(s.ouzbekRecordingP1).toBeNull();
  });

  it("clicking 'Retour au menu' resets state and returns to menu", async () => {
    const user = userEvent.setup();
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    await user.click(screen.getByRole("button", { name: /retour au menu/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("menu");
    expect(s.mode).toBe("mode1");
  });

  it("renders an alert when an artefact is missing (defensive)", () => {
    useGameStore.setState({ ouzbekRecordingP3: null });
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
