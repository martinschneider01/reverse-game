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
  it("renders the full chain in order: J1 audio, J2 note, J3 audio, J4 info", () => {
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    expect(screen.getByLabelText(/chaîne du round/i)).toHaveTextContent("J1 → J2 → J3 → J4");
    const kickers = screen.getAllByText(/^Joueur [1-4]$/i).map((n) => n.textContent);
    expect(kickers).toEqual(["Joueur 1", "Joueur 2", "Joueur 3", "Joueur 4"]);
    expect(screen.getByLabelText(/note de j2/i)).toHaveTextContent("transcription par J2");
    expect(screen.getByLabelText(/réponse de j4/i)).toBeInTheDocument();
  });

  it("provides forward+reverse playback on both J1 and J3 recordings", () => {
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    // Two recordings × two directions each = four direction buttons (none locked).
    expect(screen.getAllByRole("button", { name: /lecture à l'endroit/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /lecture à l'envers/i })).toHaveLength(2);
  });

  it("falls back to a placeholder when J2 took no note", () => {
    useGameStore.setState({ ouzbekNoteP2: "" });
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    expect(screen.getByText(/aucune note prise/i)).toBeInTheDocument();
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

  it("renders a download button on each reveal player (J1 + J3) (#35)", () => {
    render(
      <RevealOuzbekPhase
        audioContextFactory={audioContextFactory}
        playerFactory={makeFakePlayer}
      />,
    );
    expect(screen.getAllByRole("button", { name: /télécharger l'enregistrement/i })).toHaveLength(
      2,
    );
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

  describe("Thème de J1 (issue #39)", () => {
    it("renders the thème when J1 saved one", () => {
      useGameStore.setState({ ouzbekThemeP1: "voyage" });
      render(
        <RevealOuzbekPhase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.getByLabelText(/thème de j1/i)).toHaveTextContent(/voyage/);
    });

    it("does NOT render any thème block when ouzbekThemeP1 is empty", () => {
      useGameStore.setState({ ouzbekThemeP1: "" });
      render(
        <RevealOuzbekPhase
          audioContextFactory={audioContextFactory}
          playerFactory={makeFakePlayer}
        />,
      );
      expect(screen.queryByLabelText(/thème de j1/i)).not.toBeInTheDocument();
    });
  });
});
