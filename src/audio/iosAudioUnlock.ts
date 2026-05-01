// iOS audio category unlock — issue #18.
//
// On iOS, Web Audio output is routed to the "ringer / silent switch" channel
// by default, which produces a noticeably quieter signal than HTMLAudioElement
// (routed to the "media" channel). The well-known workaround is to play a
// short silent clip through an HTMLAudioElement on the first user gesture; the
// AVAudioSession then switches the category for the rest of the page lifetime.
//
// Activated only on iOS Safari / iPadOS so we don't pay an event listener on
// platforms that don't need it.

const GESTURE_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "pointerdown",
  "touchstart",
  "keydown",
];

// 44-byte WAV header + 1 silent 16-bit PCM sample = 46 bytes.
const SILENT_WAV_BASE64 = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

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

function defaultAudioFactory(): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${SILENT_WAV_BASE64}`);
  audio.preload = "auto";
  return audio;
}

export function installIosAudioUnlock(options: IosAudioUnlockOptions = {}): () => void {
  const enabled = options.enabled ?? isIosAudioCategoryQuirky();
  if (!enabled) {
    return () => {};
  }

  const audioFactory = options.audioFactory ?? defaultAudioFactory;
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
