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
});
