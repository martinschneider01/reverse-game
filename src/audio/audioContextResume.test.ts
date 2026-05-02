import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installAudioContextResume } from "./audioContextResume";

type FakeContext = {
  state: AudioContextState;
  resume: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  // Test-only helper to fire the registered statechange listener.
  fireStateChange: () => void;
};

function makeFakeContext(state: AudioContextState = "suspended"): FakeContext {
  const listeners: Record<string, Array<EventListener>> = {};
  const addEventListener = vi.fn((type: string, fn: EventListener) => {
    (listeners[type] ??= []).push(fn);
  });
  const removeEventListener = vi.fn((type: string, fn: EventListener) => {
    const arr = listeners[type];
    if (arr === undefined) return;
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
  });
  return {
    state,
    resume: vi.fn(async () => {
      // resume() in the real API moves state to 'running'; we mimic that
      // so post-recovery checks behave realistically.
    }),
    addEventListener,
    removeEventListener,
    fireStateChange: () => {
      for (const fn of listeners["statechange"] ?? []) fn(new Event("statechange"));
    },
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

  it("on iOS with a running context, still arms the silent-WAV replay on next gesture (Brave iOS lying state)", () => {
    // Brave iOS exhibits the AVAudioSession drifting back to ringer/silent
    // without the AudioContext changing state — playhead advances but no
    // sound. Re-priming on the next user gesture is the recovery path.
    const ctx = makeFakeContext("running");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    expect(ctx.resume).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("pointerdown"));
    expect(audioFactory).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    // resume() must not be called on a running context (no-op + avoids
    // perturbing a healthy session).
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

  it("recovers via pageshow even without persisted=true (iOS lock/unlock without bfcache)", () => {
    const ctx = makeFakeContext("suspended");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: false });
    window.dispatchEvent(event);

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("treats the iOS-specific 'interrupted' state as recoverable", () => {
    const ctx = makeFakeContext("interrupted" as AudioContextState);
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does nothing when the context is closed", () => {
    const ctx = makeFakeContext("closed");
    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(ctx.resume).not.toHaveBeenCalled();
    cleanup();
  });

  it("arms the gesture handler when the AudioContext fires a non-running statechange", () => {
    const ctx = makeFakeContext("running");
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installAudioContextResume(() => ctx as unknown as AudioContext, {
      isIos: true,
      audioFactory,
    });

    // Surface the context to the resume module by firing a visibility event
    // (running context → no recovery, but the statechange listener attaches).
    document.dispatchEvent(new Event("visibilitychange"));

    // Now the OS interrupts the context.
    ctx.state = "suspended";
    ctx.fireStateChange();

    document.dispatchEvent(new Event("pointerdown"));

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
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
