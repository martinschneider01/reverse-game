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

  it("clicking 'Mode Challenge' dispatches startChallenge and transitions to challengeConfig", async () => {
    const user = userEvent.setup();
    render(<MenuPhase />);
    await user.click(screen.getByRole("button", { name: /mode challenge/i }));
    expect(useGameStore.getState().phase).toBe("challengeConfig");
  });

  it("clicking 'Mode Ouzbek' dispatches startOuzbek, transitioning to permission with mode='ouzbek'", async () => {
    const user = userEvent.setup();
    render(<MenuPhase />);
    await user.click(screen.getByRole("button", { name: /^mode ouzbek$/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("permission");
    expect(s.mode).toBe("ouzbek");
  });

  it("clicking 'Ouzbek Challenge' dispatches startOuzbekChallenge, transitioning to ouzbekChallengeConfig", async () => {
    const user = userEvent.setup();
    render(<MenuPhase />);
    await user.click(screen.getByRole("button", { name: /ouzbek challenge/i }));
    const s = useGameStore.getState();
    expect(s.phase).toBe("ouzbekChallengeConfig");
    expect(s.mode).toBe("ouzbek");
  });
});
