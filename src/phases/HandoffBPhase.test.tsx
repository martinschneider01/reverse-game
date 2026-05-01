import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HandoffBPhase } from "./HandoffBPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "handoffB" });
});

describe("<HandoffBPhase />", () => {
  it("clicking 'Continuer' transitions to guessing", async () => {
    const user = userEvent.setup();
    render(<HandoffBPhase />);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    expect(useGameStore.getState().phase).toBe("guessing");
  });
});
