import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRecorder } from "./recorder";

type Listener = (event: { data?: Blob }) => void;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static lastInstance(): FakeMediaRecorder {
    const inst = FakeMediaRecorder.instances.at(-1);
    if (!inst) throw new Error("no FakeMediaRecorder created yet");
    return inst;
  }

  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: Listener | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: { error: Error }) => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
      });
      this.onstop?.();
    });
  });

  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
}

class FakeMediaStreamTrack {
  stop = vi.fn();
}

class FakeMediaStream {
  tracks: FakeMediaStreamTrack[] = [new FakeMediaStreamTrack()];
  getTracks() {
    return this.tracks;
  }
}

function installFakeRecorder() {
  FakeMediaRecorder.instances = [];
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
}

function installFakeGetUserMedia(impl?: () => Promise<MediaStream>) {
  const fn = vi.fn(impl ?? (async () => new FakeMediaStream() as unknown as MediaStream));
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: fn },
  });
  return fn;
}

describe("createRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installFakeRecorder();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests microphone permission with AGC/NS/EC disabled by default on start()", async () => {
    const getUserMedia = installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 1000 });

    await rec.start();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false,
      },
    });
    expect(FakeMediaRecorder.lastInstance().start).toHaveBeenCalled();
  });

  it("forwards a caller-provided audioConstraints object to getUserMedia", async () => {
    const getUserMedia = installFakeGetUserMedia();
    const rec = createRecorder({
      maxDurationMs: 1000,
      audioConstraints: { autoGainControl: true, channelCount: 1 },
    });

    await rec.start();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { autoGainControl: true, channelCount: 1 },
    });
  });

  it("stop() resolves with the recorded Blob", async () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 1000 });
    await rec.start();

    const blobPromise = rec.stop();
    await vi.runAllTimersAsync();
    const blob = await blobPromise;

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/webm");
  });

  it("stops the underlying stream tracks after stop() resolves", async () => {
    let stream: FakeMediaStream | null = null;
    installFakeGetUserMedia(async () => {
      stream = new FakeMediaStream();
      return stream as unknown as MediaStream;
    });
    const rec = createRecorder({ maxDurationMs: 1000 });
    await rec.start();

    const p = rec.stop();
    await vi.runAllTimersAsync();
    await p;

    expect(stream).not.toBeNull();
    expect(stream!.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("auto-stops when maxDurationMs elapses, stop() still resolves", async () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 500 });
    await rec.start();

    const blobPromise = rec.stop();
    await vi.advanceTimersByTimeAsync(500);
    const blob = await blobPromise;

    expect(FakeMediaRecorder.lastInstance().stop).toHaveBeenCalled();
    expect(blob).toBeInstanceOf(Blob);
  });

  it("auto-stop fires only once even if user also calls stop()", async () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 200 });
    await rec.start();

    await vi.advanceTimersByTimeAsync(200);
    await vi.runAllTimersAsync();

    const blob = await rec.stop();
    expect(FakeMediaRecorder.lastInstance().stop).toHaveBeenCalledTimes(1);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("rejects start() if getUserMedia is denied", async () => {
    installFakeGetUserMedia(async () => {
      throw new DOMException("NotAllowedError", "NotAllowedError");
    });
    const rec = createRecorder({ maxDurationMs: 1000 });

    await expect(rec.start()).rejects.toThrow(/NotAllowedError/);
  });

  it("cancel() stops without resolving stop()", async () => {
    let stream: FakeMediaStream | null = null;
    installFakeGetUserMedia(async () => {
      stream = new FakeMediaStream();
      return stream as unknown as MediaStream;
    });
    const rec = createRecorder({ maxDurationMs: 1000 });
    await rec.start();

    rec.cancel();

    expect(FakeMediaRecorder.lastInstance().stop).toHaveBeenCalled();
    expect(stream!.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("stop() called before start() rejects", async () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 1000 });

    await expect(rec.stop()).rejects.toThrow(/not.*recording/i);
  });

  it("calling start() twice rejects the second call", async () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 1000 });
    await rec.start();

    await expect(rec.start()).rejects.toThrow(/already.*recording/i);
  });

  it("cancel() before start() is a no-op (does not throw)", () => {
    installFakeGetUserMedia();
    const rec = createRecorder({ maxDurationMs: 1000 });

    expect(() => rec.cancel()).not.toThrow();
  });

  it("getStream() returns null before start() and the live MediaStream while recording", async () => {
    let stream: FakeMediaStream | null = null;
    installFakeGetUserMedia(async () => {
      stream = new FakeMediaStream();
      return stream as unknown as MediaStream;
    });
    const rec = createRecorder({ maxDurationMs: 1000 });

    expect(rec.getStream()).toBeNull();

    await rec.start();
    expect(rec.getStream()).toBe(stream);

    const p = rec.stop();
    await vi.runAllTimersAsync();
    await p;
    expect(rec.getStream()).toBeNull();
  });
});
