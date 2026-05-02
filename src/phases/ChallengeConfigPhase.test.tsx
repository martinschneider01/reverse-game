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

  it("submits a custom timer (seconds → ms) typed in the personalised input (#34)", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const timerInput = screen.getByLabelText(/personnalisé \(secondes\)/i);
    await user.type(timerInput, "45");

    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    expect(useGameStore.getState().challengeRules).toEqual({
      timerMs: 45_000,
      notesEnabled: true,
      listenLimit: null,
    });
  });

  it("submits a custom listen-limit typed in the personalised input (#34)", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });
    const limitInput = within(limitGroup.parentElement as HTMLElement).getByLabelText(
      /^personnalisé$/i,
    );
    await user.type(limitInput, "7");

    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    expect(useGameStore.getState().challengeRules).toEqual({
      timerMs: null,
      notesEnabled: true,
      listenLimit: 7,
    });
  });

  it("typing in the timer input deselects every timer chip (#34)", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    // The default chip "Aucun" (null) starts selected
    expect(within(timerGroup).getByRole("radio", { name: /aucun/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const timerInput = screen.getByLabelText(/personnalisé \(secondes\)/i);
    await user.type(timerInput, "30");

    for (const chip of within(timerGroup).getAllByRole("radio")) {
      expect(chip).toHaveAttribute("aria-checked", "false");
    }
  });

  it("clicking a preset clears the custom input (#34)", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const timerInput = screen.getByLabelText(/personnalisé \(secondes\)/i) as HTMLInputElement;
    await user.type(timerInput, "42");
    expect(timerInput.value).toBe("42");

    const timerGroup = screen.getByRole("radiogroup", { name: /timer/i });
    await user.click(within(timerGroup).getByRole("radio", { name: "60 s" }));

    expect(timerInput.value).toBe("");
    expect(within(timerGroup).getByRole("radio", { name: "60 s" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("treats empty / 0 / negative values as null on submit (#34)", async () => {
    const user = userEvent.setup();
    render(<ChallengeConfigPhase />);

    const timerInput = screen.getByLabelText(/personnalisé \(secondes\)/i);
    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });
    const limitInput = within(limitGroup.parentElement as HTMLElement).getByLabelText(
      /^personnalisé$/i,
    );

    await user.type(timerInput, "0");
    await user.type(limitInput, "0");

    await user.click(screen.getByRole("button", { name: /lancer la partie/i }));

    expect(useGameStore.getState().challengeRules).toEqual({
      timerMs: null,
      notesEnabled: true,
      listenLimit: null,
    });
  });

  it("rehydrates a custom (non-preset) timer value into the personalised input (#34)", () => {
    useGameStore.setState({
      phase: "challengeConfig",
      challengeRules: { timerMs: 45_000, notesEnabled: true, listenLimit: 7 },
    });
    render(<ChallengeConfigPhase />);

    const timerInput = screen.getByLabelText(/personnalisé \(secondes\)/i) as HTMLInputElement;
    expect(timerInput.value).toBe("45");

    const limitGroup = screen.getByRole("radiogroup", { name: /ré-écoutes/i });
    const limitInput = within(limitGroup.parentElement as HTMLElement).getByLabelText(
      /^personnalisé$/i,
    ) as HTMLInputElement;
    expect(limitInput.value).toBe("7");

    // No preset chip should be selected when a custom value is in the input
    for (const chip of within(screen.getByRole("radiogroup", { name: /timer/i })).getAllByRole(
      "radio",
    )) {
      expect(chip).toHaveAttribute("aria-checked", "false");
    }
    for (const chip of within(limitGroup).getAllByRole("radio")) {
      expect(chip).toHaveAttribute("aria-checked", "false");
    }
  });
});
