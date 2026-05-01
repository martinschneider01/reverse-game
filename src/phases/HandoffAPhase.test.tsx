import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HandoffAPhase } from "./HandoffAPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "handoffA" });
});

describe("<HandoffAPhase />", () => {
  it("clicking 'Continuer' transitions to recordingA", async () => {
    const user = userEvent.setup();
    render(<HandoffAPhase />);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    expect(useGameStore.getState().phase).toBe("recordingA");
  });
});
