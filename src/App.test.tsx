import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE });
});

describe("App", () => {
  it("renders the Reverso heading on the menu phase", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /reverso/i })).toBeInTheDocument();
  });

  it("renders the PermissionDenied phase when the store phase is permissionDenied", () => {
    useGameStore.setState({ phase: "permissionDenied" });
    render(<App />);
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });

  it("renders the ChallengeConfig phase when the store phase is challengeConfig", () => {
    useGameStore.setState({ phase: "challengeConfig" });
    render(<App />);
    expect(screen.getByRole("button", { name: /lancer la partie/i })).toBeInTheDocument();
  });

  it("renders the OuzbekChallengeConfig phase when the store phase is ouzbekChallengeConfig", () => {
    useGameStore.setState({ phase: "ouzbekChallengeConfig", mode: "ouzbek" });
    render(<App />);
    expect(screen.getByRole("heading", { name: /configurer les règles/i })).toBeInTheDocument();
    // Notes fieldset is intentionally absent (the note is the pivot of Ouzbek).
    expect(screen.queryByRole("radiogroup", { name: /^notes$/i })).not.toBeInTheDocument();
  });
});
