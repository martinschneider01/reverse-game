import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { PermissionPhase } from "./PermissionPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "permission" });
});

function makeFakeStream(): { stream: MediaStream; trackStop: ReturnType<typeof vi.fn> } {
  const trackStop = vi.fn();
  const stream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;
  return { stream, trackStop };
}

describe("<PermissionPhase />", () => {
  it("transitions to handoffA when getUserMedia resolves", async () => {
    const { stream, trackStop } = makeFakeStream();
    const requestPermission = vi.fn(async () => stream);

    render(<PermissionPhase requestPermission={requestPermission} />);

    await waitFor(() => {
      expect(useGameStore.getState().phase).toBe("handoffA");
    });
    expect(requestPermission).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });

  it("transitions to permissionDenied when getUserMedia rejects", async () => {
    const requestPermission = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });

    render(<PermissionPhase requestPermission={requestPermission} />);

    await waitFor(() => {
      expect(useGameStore.getState().phase).toBe("permissionDenied");
    });
  });
});
