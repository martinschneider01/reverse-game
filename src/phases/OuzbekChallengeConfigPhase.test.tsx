import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OuzbekChallengeConfigPhase } from "./OuzbekChallengeConfigPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({
    ...INITIAL_STATE,
    phase: "ouzbekChallengeConfig",
    mode: "ouzbek",
  });
});

describe("<OuzbekChallengeConfigPhase />", () => {
  it("renders only the timer and ré-écoutes fieldsets — notes is omitted (the note is the pivot)", () => {
    render(<OuzbekChallengeConfigPhase />);
    expect(screen.getByRole("radiogroup", { name: /timer/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /ré-écoutes/i })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /^notes$/i })).not.toBeInTheDocument();
  });

  it("defaults to no constraints — submitting unchanged keeps notesEnabled=true (the chain still works)", async () => {
    const user = userEvent.setup();
    render(<OuzbekChallengeConfigPhase />);
    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("permission");
    expect(s.mode).toBe("ouzbek");
    expect(s.challengeRules).toEqual({
      timerMs: null,
      notesEnabled: true,
      listenLimit: null,
    });
  });

  it("submits the selected timer / listen-limit combination, always notesEnabled=true", async () => {
    const user = userEvent.setup();
    render(<OuzbekChallengeConfigPhase />);

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });

    await user.click(within(timerGroup).getByRole("radio", { name: "120 s" }));
    await user.click(within(limitGroup).getByRole("radio", { name: "3" }));

    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("permission");
    expect(s.challengeRules).toEqual({
      timerMs: 120_000,
      notesEnabled: true,
      listenLimit: 3,
    });
  });

  it("clicking 'Annuler' returns to the menu without writing rules", async () => {
    const user = userEvent.setup();
    render(<OuzbekChallengeConfigPhase />);

    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });
    await user.click(within(limitGroup).getByRole("radio", { name: "5" }));

    await user.click(screen.getByRole("button", { name: /annuler/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("menu");
    expect(s.challengeRules).toBeNull();
  });

  it("rehydrates the form from previously stored challengeRules but forces notesEnabled=true", () => {
    useGameStore.setState({
      phase: "ouzbekChallengeConfig",
      mode: "ouzbek",
      // notesEnabled=false would have been set in error — Ouzbek must coerce to true
      challengeRules: { timerMs: 180_000, notesEnabled: false, listenLimit: 1 },
    });
    render(<OuzbekChallengeConfigPhase />);

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });

    expect(within(timerGroup).getByRole("radio", { name: "180 s" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(limitGroup).getByRole("radio", { name: "1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
