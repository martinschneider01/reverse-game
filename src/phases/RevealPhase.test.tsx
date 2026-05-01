import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealPhase } from "./RevealPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import type { Recording } from "@/audio/recording";

const fakeRecording: Recording = {
  forward: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  reverse: { length: 24000, sampleRate: 48000 } as unknown as AudioBuffer,
  durationMs: 500,
};

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "reveal",
    originalRecording: fakeRecording,
  });
});

describe("<RevealPhase />", () => {
  it("clicking 'Retour au menu' resets the store and transitions to menu", async () => {
    const user = userEvent.setup();
    render(<RevealPhase />);
    await user.click(screen.getByRole("button", { name: /retour au menu/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("menu");
    expect(s.originalRecording).toBeNull();
  });
});
