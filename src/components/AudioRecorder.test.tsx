import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioRecorder } from "./AudioRecorder";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";

function makeFakeRecorder(blob: Blob): {
  recorder: Recorder;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(async () => {});
  const stop = vi.fn(async () => blob);
  const cancel = vi.fn();
  const getStream = vi.fn(() => null);
  return { recorder: { start, stop, cancel, getStream }, start, stop };
}

describe("<AudioRecorder />", () => {
  it("clicking Enregistrer starts the recorder, then clicking Arrêter decodes, reverses, and emits a Recording", async () => {
    const user = userEvent.setup();
    const blob = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const { recorder, start, stop } = makeFakeRecorder(blob);
    const recorderFactory = vi.fn((_opts: RecorderOptions) => recorder);

    const forward = {
      numberOfChannels: 1,
      length: 24000,
      sampleRate: 48000,
    } as unknown as AudioBuffer;
    const reversed = {
      numberOfChannels: 1,
      length: 24000,
      sampleRate: 48000,
    } as unknown as AudioBuffer;
    const decode = vi.fn(async () => forward);
    const reverse = vi.fn(() => reversed);
    const audioContextFactory = vi.fn(() => ({}) as AudioContext);
    const onRecorded = vi.fn();

    render(
      <AudioRecorder
        maxDurationMs={1000}
        onRecorded={onRecorded}
        recorderFactory={recorderFactory}
        audioContextFactory={audioContextFactory}
        decode={decode}
        reverse={reverse}
      />,
    );

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(recorderFactory).toHaveBeenCalledWith({ maxDurationMs: 1000 });
    expect(start).toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: /arrêter/i }));
    expect(stop).toHaveBeenCalled();

    expect(decode).toHaveBeenCalledWith(blob, expect.anything());
    expect(reverse).toHaveBeenCalledWith(forward, expect.anything());
    expect(onRecorded).toHaveBeenCalledWith({
      forward,
      reverse: reversed,
      durationMs: 500,
      blob,
    });
    expect(await screen.findByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("displays an error and a retry button when start() rejects (e.g. permission denied)", async () => {
    const user = userEvent.setup();
    const recorderFactory = vi.fn(
      () =>
        ({
          start: vi.fn(async () => {
            throw new Error("NotAllowedError");
          }),
          stop: vi.fn(),
          cancel: vi.fn(),
          getStream: vi.fn(() => null),
        }) satisfies Recorder,
    );

    render(
      <AudioRecorder
        maxDurationMs={1000}
        onRecorded={vi.fn()}
        recorderFactory={recorderFactory}
        audioContextFactory={() => ({}) as AudioContext}
        decode={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/NotAllowedError/);
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });
});
