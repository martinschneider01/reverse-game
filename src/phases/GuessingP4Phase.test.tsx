import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuessingP4Phase } from "./GuessingP4Phase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recording } from "@/audio/recording";
import type { Player } from "@/audio/wrappers/player";

const fakeP3: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
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
    phase: "guessingP4",
    mode: "ouzbek",
    ouzbekRecordingP3: fakeP3,
  });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

const audioContextFactory = (): AudioContext => ({}) as AudioContext;

describe("<GuessingP4Phase />", () => {
  it("renders the J3 player locked in reverse", () => {
    const player = makeFakePlayer();
    render(
      <GuessingP4Phase audioContextFactory={audioContextFactory} playerFactory={() => player} />,
    );
    expect(player.setDirection).toHaveBeenCalledWith("reverse");
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).not.toBeDisabled();
  });

  it("clicking 'Tout révéler' transitions to revealOuzbek", async () => {
    const user = userEvent.setup();
    render(
      <GuessingP4Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.click(screen.getByRole("button", { name: /tout révéler/i }));
    expect(useGameStore.getState().phase).toBe("revealOuzbek");
  });

  it("renders an alert when the J3 recording is missing", () => {
    useGameStore.setState({ ouzbekRecordingP3: null });
    render(
      <GuessingP4Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
