import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealPhase } from "./RevealPhase";
import { useGameStore, INITIAL_STATE, DEFAULT_CHALLENGE_RULES } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recording } from "@/audio/recording";
import type { Player } from "@/audio/wrappers/player";

const fakeOriginal: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  gain: 1,
  blob: new Blob(),
};

const fakeGuess: Recording = {
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

const audioContextFactory = (): AudioContext => ({}) as AudioContext;

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "reveal",
    originalRecording: fakeOriginal,
    guessRecording: fakeGuess,
    notes: "ma note",
    listenCount: 3,
  });
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
});

describe("<RevealPhase />", () => {
  it("renders one player per recording (original + guess) and shows the notes", () => {
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    // Each AudioPlayer renders both a forward and a reverse button.
    expect(screen.getAllByRole("button", { name: /lecture à l'endroit/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /lecture à l'envers/i })).toHaveLength(2);
    expect(screen.getByLabelText(/notes/i)).toHaveTextContent("ma note");
  });

  it("primes the 'Voix du joueur 2' player in reverse via initialDirection", () => {
    const players: Player[] = [];
    render(
      <RevealPhase
        audioContextFactory={audioContextFactory}
        playerFactory={() => {
          const p = makeFakePlayer();
          players.push(p);
          return p;
        }}
      />,
    );
    expect(players).toHaveLength(2);
    // Original: no setDirection call (initialDirection defaults to forward).
    expect(players[0]!.setDirection).not.toHaveBeenCalled();
    // Guess: setDirection("reverse") called once on mount.
    expect(players[1]!.setDirection).toHaveBeenCalledWith("reverse");
  });

  it("renders only the original player when guessRecording is null", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "reveal",
      originalRecording: fakeOriginal,
      notes: "",
    });
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getAllByRole("button", { name: /lecture à l'endroit/i })).toHaveLength(1);
    expect(screen.getByText(/aucune note prise/i)).toBeInTheDocument();
  });

  it("clicking 'Nouvelle partie' resets per-round slices and transitions to recordingA", async () => {
    const user = userEvent.setup();
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.click(screen.getByRole("button", { name: /nouvelle partie/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("recordingA");
    expect(s.originalRecording).toBeNull();
    expect(s.guessRecording).toBeNull();
    expect(s.notes).toBe("");
    expect(s.listenCount).toBe(0);
  });

  it("clicking 'Retour au menu' resets the store and transitions to menu", async () => {
    const user = userEvent.setup();
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    await user.click(screen.getByRole("button", { name: /retour au menu/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("menu");
    expect(s.originalRecording).toBeNull();
    expect(s.guessRecording).toBeNull();
    expect(s.notes).toBe("");
    expect(s.listenCount).toBe(0);
  });

  it("renders the notes section in Mode 1 (challengeRules === null)", () => {
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("heading", { name: /^notes$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toHaveTextContent("ma note");
  });

  it("renders the notes section when challengeRules.notesEnabled is true", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "reveal",
      originalRecording: fakeOriginal,
      guessRecording: fakeGuess,
      notes: "ma note",
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, notesEnabled: true },
    });
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("heading", { name: /^notes$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toHaveTextContent("ma note");
  });

  it("hides the notes section when challengeRules.notesEnabled is false", () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      phase: "reveal",
      originalRecording: fakeOriginal,
      guessRecording: fakeGuess,
      notes: "ma note",
      challengeRules: { ...DEFAULT_CHALLENGE_RULES, notesEnabled: false },
    });
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.queryByRole("heading", { name: /^notes$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    // The two players (original + guess) should still render.
    expect(screen.getAllByRole("button", { name: /lecture à l'endroit/i })).toHaveLength(2);
  });

  it("renders a download button on each reveal player (#35)", () => {
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    // One on the original card, one on the guess card.
    expect(screen.getAllByRole("button", { name: /télécharger l'enregistrement/i })).toHaveLength(
      2,
    );
  });

  it("renders a defensive alert when originalRecording is null", () => {
    useGameStore.setState({ ...INITIAL_STATE, phase: "reveal" });
    render(
      <RevealPhase audioContextFactory={audioContextFactory} playerFactory={makeFakePlayer} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lecture à l'endroit/i })).not.toBeInTheDocument();
  });
});
