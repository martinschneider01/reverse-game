import { describe, it, expect, vi } from "vitest";
import {
  installIosAudioUnlock,
  isIosAudioCategoryQuirky,
  primeIosAudioSession,
} from "./iosAudioUnlock";

describe("isIosAudioCategoryQuirky", () => {
  it("returns true for iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(isIosAudioCategoryQuirky(ua)).toBe(true);
  });

  it("returns true for iPad on iPadOS reporting as desktop Safari", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/605.1";
    expect(isIosAudioCategoryQuirky(ua)).toBe(true);
  });

  it("returns false for desktop Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(isIosAudioCategoryQuirky(ua)).toBe(false);
  });

  it("returns false for Android Chrome", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(isIosAudioCategoryQuirky(ua)).toBe(false);
  });
});

describe("installIosAudioUnlock", () => {
  it("returns a no-op cleanup and registers no listeners when disabled", () => {
    const addSpy = vi.spyOn(document, "addEventListener");

    const cleanup = installIosAudioUnlock({ enabled: false });

    expect(addSpy).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe("function");
    addSpy.mockRestore();
  });

  it("plays the silent audio on the first user gesture, then unregisters", () => {
    const play = vi.fn(() => Promise.resolve());
    const audio = { play, preload: "auto" } as unknown as HTMLAudioElement;
    const audioFactory = vi.fn(() => audio);

    const cleanup = installIosAudioUnlock({ enabled: true, audioFactory });

    document.dispatchEvent(new Event("pointerdown"));

    expect(audioFactory).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("pointerdown"));
    document.dispatchEvent(new Event("touchstart"));

    expect(audioFactory).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("triggers on touchstart or keydown if those come before pointerdown", () => {
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    installIosAudioUnlock({ enabled: true, audioFactory });

    document.dispatchEvent(new Event("touchstart"));

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("manual cleanup() removes the listeners before any gesture fires", () => {
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    const cleanup = installIosAudioUnlock({ enabled: true, audioFactory });
    cleanup();

    document.dispatchEvent(new Event("pointerdown"));

    expect(audioFactory).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("swallows play() rejection (e.g. lost user-gesture state)", () => {
    const play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    installIosAudioUnlock({ enabled: true, audioFactory });

    expect(() => document.dispatchEvent(new Event("pointerdown"))).not.toThrow();
  });
});

describe("primeIosAudioSession", () => {
  it("plays the silent WAV when enabled (every call, not gated by triggered flag)", () => {
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    primeIosAudioSession({ enabled: true, audioFactory });
    primeIosAudioSession({ enabled: true, audioFactory });
    primeIosAudioSession({ enabled: true, audioFactory });

    expect(audioFactory).toHaveBeenCalledTimes(3);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("is a no-op when disabled", () => {
    const play = vi.fn(() => Promise.resolve());
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    primeIosAudioSession({ enabled: false, audioFactory });

    expect(audioFactory).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("swallows play() rejection", () => {
    const play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
    const audioFactory = vi.fn(() => ({ play, preload: "auto" }) as unknown as HTMLAudioElement);

    expect(() => primeIosAudioSession({ enabled: true, audioFactory })).not.toThrow();
  });
});
