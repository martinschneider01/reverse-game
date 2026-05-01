import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuPhase } from "./MenuPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE });
});

describe("<MenuPhase />", () => {
  it("renders the Reverso wordmark as the page heading", () => {
    render(<MenuPhase />);
    expect(screen.getByRole("heading", { level: 1, name: /reverso/i })).toBeInTheDocument();
  });

  it("renders the 'Comment ça marche' disclosure with three steps", () => {
    render(<MenuPhase />);
    expect(screen.getByText(/comment ça marche/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("clicking 'Nouvelle partie' dispatches startGame and transitions to permission", async () => {
    const user = userEvent.setup();
    render(<MenuPhase />);
    await user.click(screen.getByRole("button", { name: /nouvelle partie/i }));
    expect(useGameStore.getState().phase).toBe("permission");
  });
});
