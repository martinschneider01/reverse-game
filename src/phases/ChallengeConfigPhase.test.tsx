import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChallengeConfigPhase } from "./ChallengeConfigPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "challengeConfig" });
});

describe("<ChallengeConfigPhase />", () => {
  it("renders the three rule fieldsets", () => {
    render(<ChallengeConfigPhase />);
    expect(screen.getByRole("radiogroup", { name: /timer/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /^notes$/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /ré-écoutes/i })).toBeInTheDocument();
  });

  it("defaults all rules to 'off' so submitting unchanged behaves like Mode 1", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);
    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("permission");
    expect(s.challengeRules).toEqual({
      timerMs: null,
      notesEnabled: true,
      listenLimit: null,
    });
  });

  it("submits the selected timer / notes / listen-limit combination", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    const notesGroup = screen.getByRole("radiogroup", { name: /^notes$/i });
    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });

    await user.click(within(timerGroup).getByRole("radio", { name: "120 s" }));
    await user.click(within(notesGroup).getByRole("radio", { name: /désactivées/i }));
    await user.click(within(limitGroup).getByRole("radio", { name: "3" }));

    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    expect(useGameStore.getState().challengeRules).toEqual({
      timerMs: 120_000,
      notesEnabled: false,
      listenLimit: 3,
    });
    expect(useGameStore.getState().phase).toBe("permission");
  });

  it("clicking 'Annuler' returns to the menu without writing rules", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });
    await user.click(within(limitGroup).getByRole("radio", { name: "5" }));

    await user.click(screen.getByRole("button", { name: /annuler/i }));

    const s = useGameStore.getState();
    expect(s.phase).toBe("menu");
    expect(s.challengeRules).toBeNull();
  });

  it("rehydrates the form from previously stored challengeRules (e.g. after lock screen)", () => {
    useGameStore.setState({
      phase: "challengeConfig",
      challengeRules: { timerMs: 180_000, notesEnabled: false, listenLimit: 1 },
    });
    render(<ChallengeConfigPhase />);

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    const notesGroup = screen.getByRole("radiogroup", { name: /^notes$/i });
    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });

    expect(within(timerGroup).getByRole("radio", { name: "180 s" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(notesGroup).getByRole("radio", { name: /désactivées/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(limitGroup).getByRole("radio", { name: "1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
