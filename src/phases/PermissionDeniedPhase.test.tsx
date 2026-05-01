import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionDeniedPhase } from "./PermissionDeniedPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "permissionDenied" });
});

describe("<PermissionDeniedPhase />", () => {
  it("clicking 'Réessayer' transitions back to permission", async () => {
    const user = userEvent.setup();
    render(<PermissionDeniedPhase />);
    await user.click(screen.getByRole("button", { name: /réessayer/i }));
    expect(useGameStore.getState().phase).toBe("permission");
  });

  it("clicking 'Retour au menu' transitions to menu", async () => {
    const user = userEvent.setup();
    render(<PermissionDeniedPhase />);
    await user.click(screen.getByRole("button", { name: /retour au menu/i }));
    expect(useGameStore.getState().phase).toBe("menu");
  });
});
