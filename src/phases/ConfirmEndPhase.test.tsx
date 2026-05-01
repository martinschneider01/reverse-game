import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmEndPhase } from "./ConfirmEndPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
  blob: new Blob(),
};

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "confirmEnd",
    notes: "wip",
    guessRecording: fakeRecording,
    listenCount: 4,
  });
});

describe("<ConfirmEndPhase />", () => {
  it("clicking 'Confirmer' transitions to reveal", async () => {
    const user = userEvent.setup();
    render(<ConfirmEndPhase />);
    await user.click(screen.getByRole("button", { name: /confirmer/i }));
    expect(useGameStore.getState().phase).toBe("reveal");
  });

  it("clicking 'Annuler' returns to guessing while preserving notes, guess and counter", async () => {
    const user = userEvent.setup();
    render(<ConfirmEndPhase />);
    await user.click(screen.getByRole("button", { name: /annuler/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("guessing");
    expect(s.notes).toBe("wip");
    expect(s.guessRecording).toBe(fakeRecording);
    expect(s.listenCount).toBe(4);
  });
});
