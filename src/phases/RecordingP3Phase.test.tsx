import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingP3Phase } from "./RecordingP3Phase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "recordingP3",
    mode: "ouzbek",
    ouzbekNoteP2: "transcription par J2",
  });
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

function renderPhase(player?: Player) {
  const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
  const recorder = makeFakeRecorder(blob);
  const fakePlayer = player ?? makeFakePlayer();
  render(
    <RecordingP3Phase
      audioContextFactory={() => ({}) as AudioContext}
      recorderFactory={vi.fn((_opts: RecorderOptions) => recorder)}
      playerFactory={vi.fn(() => fakePlayer)}
      decode={vi.fn(async () => fakeForward)}
      reverse={vi.fn(() => fakeReversed)}
    />,
  );
  return { recorder, fakePlayer };
}

describe("<RecordingP3Phase />", () => {
  it("displays J2's note before recording starts", () => {
    renderPhase();
    expect(screen.getByLabelText(/note de j2/i)).toHaveTextContent("transcription par J2");
  });

  it("falls back to '<em>Aucune note prise</em>' when the note is empty", () => {
    useGameStore.setState({ ouzbekNoteP2: "" });
    renderPhase();
    expect(screen.getByText(/aucune note prise/i)).toBeInTheDocument();
  });

  it("keeps J2's note visible while the recorder is actively capturing", async () => {
    const user = userEvent.setup();
    renderPhase();

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    // Recorder is now in the "recording" state — the Stop button proves it.
    expect(await screen.findByRole("button", { name: /arrêter/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note de j2/i)).toHaveTextContent("transcription par J2");
  });

  it("renders the note with the readable styling class so it can be read at a glance", () => {
    renderPhase();
    expect(screen.getByLabelText(/note de j2/i)).toHaveClass("ouzbek-note-text");
  });

  it("preview player locks direction to forward (reverse button disabled per §3.13)", async () => {
    const user = userEvent.setup();
    const player = makeFakePlayer();
    renderPhase(player);

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    await user.click(await screen.findByRole("button", { name: /arrêter/i }));

    expect(await screen.findByRole("heading", { name: /pré-écoute/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).toBeDisabled();
  });

  it("does NOT leak the J1 thème to J3 (issue #39)", () => {
    useGameStore.setState({ ouzbekThemeP1: "voyage" });
    renderPhase();
    expect(screen.queryByLabelText(/thème de j1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Thème :/i)).not.toBeInTheDocument();
  });

  it("clicking 'Passer au Joueur 4' transitions to handoffP4 with the recording stored", async () => {
    const user = userEvent.setup();
    renderPhase();

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    await user.click(await screen.findByRole("button", { name: /arrêter/i }));
    await user.click(await screen.findByRole("button", { name: /passer au joueur 4/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("handoffP4");
    expect(s.ouzbekRecordingP3?.forward).toBe(fakeForward);
  });
});
