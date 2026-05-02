import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuessingP2Phase } from "./GuessingP2Phase";
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
    phase: "guessingP2",
    mode: "ouzbek",
    ouzbekRecordingP1: fakeP1,
  });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

const audioContextFactory = (): AudioContext => ({}) as AudioContext;

describe("<GuessingP2Phase />", () => {
  it("renders the J1 player locked in reverse", () => {
    const player = makeFakePlayer();
    render(
      <GuessingP2Phase audioContextFactory={audioContextFactory} playerFactory={() => player} />,
    );
    expect(player.setDirection).toHaveBeenCalledWith("reverse");
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).not.toBeDisabled();
  });

  it("typing in the notes textarea writes to ouzbekNoteP2", async () => {
    const user = userEvent.setup();
    render(
      <GuessingP2Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    const textarea = screen.getByRole("textbox", { name: /notes/i });
    await user.type(textarea, "abc");
    expect(useGameStore.getState().ouzbekNoteP2).toBe("abc");
  });

  it("clicking 'Passer au Joueur 3' transitions to handoffP3", async () => {
    const user = userEvent.setup();
    render(
      <GuessingP2Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.click(screen.getByRole("button", { name: /passer au joueur 3/i }));
    expect(useGameStore.getState().phase).toBe("handoffP3");
  });

  it("renders an alert when the J1 recording is missing", () => {
    useGameStore.setState({ ouzbekRecordingP1: null });
    render(
      <GuessingP2Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does NOT leak the J1 thème to J2 (issue #39)", () => {
    useGameStore.setState({ ouzbekThemeP1: "voyage" });
    render(
      <GuessingP2Phase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.queryByLabelText(/thème de j1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/voyage/i)).not.toBeInTheDocument();
  });

  describe("Challenge rules", () => {
    it("does not render a listen counter when no challengeRules are set (vanilla Ouzbek)", () => {
      useGameStore.setState({ challengeRules: null });
      render(
        <GuessingP2Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.queryByLabelText(/compteur d'écoutes/i)).not.toBeInTheDocument();
    });

    it("renders the listen counter and its limit when listenLimit is set", () => {
      useGameStore.setState({
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
        listenCount: 1,
      });
      render(
        <GuessingP2Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/compteur d'écoutes/i)).toHaveTextContent(/Écoutes : 1 \/ 3/);
    });

    it("disables the reverse playback when listen limit is reached", () => {
      useGameStore.setState({
        challengeRules: { timerMs: null, notesEnabled: true, listenLimit: 3 },
        listenCount: 3,
      });
      render(
        <GuessingP2Phase
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
        <GuessingP2Phase
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
        <GuessingP2Phase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/temps restant/i)).toBeInTheDocument();
    });
  });
});
