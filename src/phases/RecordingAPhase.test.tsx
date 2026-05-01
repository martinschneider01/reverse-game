import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingAPhase } from "./RecordingAPhase";
import { useGameStore, INITIAL_STATE } from "@/store/gameStore";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE, phase: "recordingA" });
});

function makeFakeRecorder(blob: Blob): Recorder {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => blob),
    cancel: vi.fn(),
  };
}

describe("<RecordingAPhase />", () => {
  it("forwards the recorded Recording to finishRecordingA, transitioning to done", async () => {
    const user = userEvent.setup();
    const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const recorder = makeFakeRecorder(blob);
    const recorderFactory = vi.fn((_opts: RecorderOptions) => recorder);

    const forward = {
      length: 24000,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as unknown as AudioBuffer;
    const reversed = {
      length: 24000,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as unknown as AudioBuffer;

    render(
      <RecordingAPhase
        audioContextFactory={() => ({}) as AudioContext}
        recorderFactory={recorderFactory}
        decode={vi.fn(async () => forward)}
        reverse={vi.fn(() => reversed)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(recorderFactory).toHaveBeenCalledWith({ maxDurationMs: 15000 });

    await user.click(await screen.findByRole("button", { name: /arrêter/i }));

    await vi.waitFor(() => {
      const s = useGameStore.getState();
      expect(s.phase).toBe("done");
      expect(s.originalRecording).toEqual({
        forward,
        reverse: reversed,
        durationMs: 500,
      });
    });
  });
});
