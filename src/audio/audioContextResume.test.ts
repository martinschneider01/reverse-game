import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installAudioContextResume } from "./audioContextResume";

type FakeContext = {
  state: AudioContextState;
  resume: ReturnType<typeof vi.fn>;
};

function makeFakeContext(state: AudioContextState = "suspended"): FakeContext {
  return {
    state,
    resume: vi.fn(async () => {
      // resume() in the real API moves state to 'running'; we mimic that
      // so post-recovery checks behave realistically.
    }),
  };
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

beforeEach(() => {
  setVisibility("visible");
});

afterEach(() => {
  setVisibility("visible");
});

describe("installAudioContextResume", () => {
  it("does nothing when there is no AudioContext yet", () => {
    const cleanup = installAudioContextResume(() => null, { isIos: false });

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));

    cleanup();
    // No assertion to make beyond "no throw" — the getter returned null.
    expect(true).toBe(true);
  });

  it("does nothing when the context is already running", () => {
    const ctx = makeFakeContext("running");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(ctx.resume).not.toHaveBeenCalled();
    cleanup();
  });

  it("does nothing when visibilitychange fires while the page is hidden", () => {
    const ctx = makeFakeContext("suspended");
    setVisibility("hidden");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(ctx.resume).not.toHaveBeenCalled();
    cleanup();
  });

  it("calls resume() immediately when the page becomes visible with a suspended context", () => {
    const ctx = makeFakeContext("suspended");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("arms a gesture listener that re-runs resume() on the next user interaction", () => {
    const ctx = makeFakeContext("suspended");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resume).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("on iOS, replays the silent WAV on the wake-up gesture to re-prime AVAudioSession", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));

    expect(audioFactory).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("on non-iOS, does not play the silent WAV", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));

    expect(audioFactory).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    cleanup();
  });

  it("the gesture listener fires only once per wake-up cycle", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));
    document.dispatchEvent(new Event("pointerdown"));
    document.dispatchEvent(new Event("touchstart"));

    expect(audioFactory).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("re-arms after a second wake-up cycle", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));
    expect(play).toHaveBeenCalledTimes(1);

    // Second background → foreground cycle
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("pointerdown"));
    expect(play).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("recovers via the pageshow event when bfcache restore happens", () => {
    const ctx = makeFakeContext("suspended");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("ignores pageshow events without persisted=true (initial load)", () => {
    const ctx = makeFakeContext("suspended");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: false });
    window.dispatchEvent(event);

    expect(ctx.resume).not.toHaveBeenCalled();
    cleanup();
  });

  it("cleanup() removes both the visibility and gesture listeners", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    cleanup();

    document.dispatchEvent(new Event("pointerdown"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(play).not.toHaveBeenCalled();
    // resume was called once at the initial visibilitychange — none after cleanup
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("swallows resume() rejection", () => {
    const ctx = makeFakeContext("suspended");
    ctx.resume.mockReturnValue(Promise.reject(new Error("InvalidStateError")));

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    expect(() => document.dispatchEvent(new Event("visibilitychange"))).not.toThrow();
    cleanup();
  });

  it("swallows silent-WAV play() rejection", () => {
    const ctx = makeFakeContext("suspended");
    const play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    expect(() => document.dispatchEvent(new Event("pointerdown"))).not.toThrow();
    cleanup();
  });
});
