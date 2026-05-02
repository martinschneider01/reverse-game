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

  describe("Challenge rules", () => {
    it("does not render a listen counter when no challengeRules are set (vanilla Ouzbek)", () => {
      useGameStore.setState({ challengeRules: null });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.queryByLabelText(/compteur d'écoutes/i)).not.toBeInTheDocument();
    });

    it("renders the listen counter and its limit when listenLimit is set", () => {
      useGameStore.setState({
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
        listenCount: 2,
      });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent(/Écoutes : 2 \/ 3/);
    });

    it("disables reverse playback when listen limit is reached", () => {
      useGameStore.setState({
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
        listenCount: 3,
      });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByRole("button", { name: /lecture à l'envers/i })).toBeDisabled();
    });

    it("clicking play increments the listen count", async () => {
      useGameStore.setState({
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
        listenCount: 0,
      });
      const user = userEvent.setup();
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      await user.click(screen.getByRole("button", { name: /lecture à l'envers/i }));
      expect(useGameStore.getState().listenCount).toBe(1);
    });

    it("renders the timer chip when a timer rule is active", () => {
      useGameStore.setState({
        challengeRules: { timerMs: 60_000, notesEnabled: true, listenLimit: null },
        guessingStartedAt: Date.now(),
      });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/temps restant/i)).toBeInTheDocument();
    });
  });

  describe("Thème de J1 (issue #39)", () => {
    it("renders the thème when J1 saved one", () => {
      useGameStore.setState({ ouzbekThemeP1: "voyage" });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/thème de j1/i)).toHaveTextContent(/voyage/);
    });

    it("does NOT render any thème block when ouzbekThemeP1 is empty", () => {
      useGameStore.setState({ ouzbekThemeP1: "" });
      render(
        <GuessingP4Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.queryByLabelText(/thème de j1/i)).not.toBeInTheDocument();
    });
  });
});
