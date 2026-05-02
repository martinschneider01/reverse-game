import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HandoffPhase } from "./HandoffPhase";

describe("<HandoffPhase />", () => {
  it("renders the title with the active player number", () => {
    render(<HandoffPhase player={2} others={[1, 3, 4]} onContinue={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /joueur 2.*téléphone/i })).toBeInTheDocument();
  });

  it("lists the other players in the consigne", () => {
    render(<HandoffPhase player={3} others={[1, 2, 4]} onContinue={vi.fn()} />);
    expect(screen.getByText(/Joueurs 1, 2, 4/)).toBeInTheDocument();
  });

  it("clicking the confirmation button calls onContinue", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<HandoffPhase player={4} others={[1, 2, 3]} onContinue={onContinue} />);
    await user.click(screen.getByRole("button", { name: /c'est moi, j4/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
