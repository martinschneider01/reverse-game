// iOS audio category unlock — issue #18, hardened by issue #20 follow-up.
//
// On iOS, Web Audio output is routed to the "ringer / silent switch" channel
// by default, which produces a noticeably quieter signal than HTMLAudioElement
// (routed to the "media" channel). The well-known workaround is to play a
// short silent clip through an HTMLAudioElement on the first user gesture; the
// AVAudioSession then switches the category for the rest of the page lifetime.
//
// "For the rest of the page lifetime" turned out to be optimistic: after a
// few minutes of screen lock or backgrounding, the category drifts back —
// sometimes without the AudioContext changing state at all (waveform plays,
// no sound). So we also expose `primeIosAudioSession()` that callers (the
// AudioPlayer click handler) invoke on every play tap to re-prime the
// category. The silent WAV is 46 bytes; the cost is negligible.
//
// Activated only on iOS Safari / iPadOS so we don't pay an event listener on
// platforms that don't need it.

const GESTURE_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "pointerdown",
  "touchstart",
  "keydown",
];

// 44-byte WAV header + 1 silent 16-bit PCM sample = 46 bytes.
export const SILENT_WAV_BASE64 = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

export function defaultSilentAudioFactory(): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${SILENT_WAV_BASE64}`);
  audio.preload = "auto";
  return audio;
}

export type PrimeIosAudioSessionOptions = {
  enabled?: boolean;
  audioFactory?: () => HTMLAudioElement;
};

// Re-prime the AVAudioSession category by playing a silent WAV through an
// HTMLAudioElement. Must be called inside a user gesture. No-op off iOS.
export function primeIosAudioSession(options: PrimeIosAudioSessionOptions = {}): void {
  const enabled = options.enabled ?? isIosAudioCategoryQuirky();
  if (!enabled) return;
  const audioFactory = options.audioFactory ?? defaultSilentAudioFactory;
  const audio = audioFactory();
  void audio.play().catch(() => {});
}

export function isIosAudioCategoryQuirky(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  // iOS Safari and iPadOS Safari.
  // iPadOS reports "Macintosh" + "Mobile" in modern Safari, hence the second
  // branch.
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isIpadDesktopUa = /Macintosh/.test(ua) && /Mobile/.test(ua);
  return isIos || isIpadDesktopUa;
}

export type IosAudioUnlockOptions = {
  enabled?: boolean;
  audioFactory?: () => HTMLAudioElement;
};

export function installIosAudioUnlock(options: IosAudioUnlockOptions = {}): () => void {
  const enabled = options.enabled ?? isIosAudioCategoryQuirky();
  if (!enabled) {
    return () => {};
  }

  const audioFactory = options.audioFactory ?? defaultSilentAudioFactory;
  let triggered = false;

  function unlock(): void {
    if (triggered) return;
    triggered = true;
    const audio = audioFactory();
    // play() may reject if user gesture state is lost; we deliberately swallow
    // that — the worst case is the audio category stays on ringer.
    void audio.play().catch(() => {});
    cleanup();
  }

  function cleanup(): void {
    for (const event of GESTURE_EVENTS) {
      document.removeEventListener(event, unlock);
    }
  }

  for (const event of GESTURE_EVENTS) {
    document.addEventListener(event, unlock, { once: false, passive: true });
  }

  return cleanup;
}
