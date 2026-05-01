import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuPhase } from "./MenuPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE });
});

describe("<MenuPhase />", () => {
  it("clicking 'Démarrer une partie' dispatches startGame and transitions to permission", async () => {
    const user = userEvent.setup();
    render(<MenuPhase />);
    await user.click(screen.getByRole("button", { name: /démarrer une partie/i }));
    expect(useGameStore.getState().phase).toBe("permission");
  });
});
