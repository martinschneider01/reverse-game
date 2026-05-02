// AudioContext recovery after the page returns from background — issue #20.
//
// On iOS, when the screen locks or the user switches apps/tabs, two things
// happen that defeat audio playback:
//   1. The AudioContext is suspended. AudioContext.resume() outside a user
//      gesture is a no-op on iOS, so calling it from a visibilitychange
//      handler may not actually resume.
//   2. The AVAudioSession category drifts back to "ambient" / "ringer". Even
//      if the context resumes, output is silent or near-silent until a
//      <audio> element is played to re-prime the session category.
//
// Recovery strategy: on every "page is visible again" transition where the
// AudioContext is suspended, (a) try resume() immediately (works on Chrome /
// Firefox), and (b) arm a one-shot user-gesture listener that re-runs
// resume() and (on iOS) replays a silent WAV to re-prime AVAudioSession. The
// user's next interaction — typically tapping a play button — triggers
// recovery; the click handler on the play button then sees a running context.

import { isIosAudioCategoryQuirky } from "./iosAudioUnlock";

const GESTURE_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "pointerdown",
  "touchstart",
  "keydown",
];

// Same 46-byte silent WAV used by iosAudioUnlock — kept as a literal here to
// keep the module self-contained (the constant is tiny and avoiding the
// shared export keeps the unlock module's surface narrow).
const SILENT_WAV_BASE64 = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";

function defaultAudioFactory(): HTMLAudioElement {
  const audio = new Audio(`data:audio/wav;base64,${SILENT_WAV_BASE64}`);
  audio.preload = "auto";
  return audio;
}

export type AudioContextResumeOptions = {
  isIos?: boolean;
  audioFactory?: () => HTMLAudioElement;
};

export function installAudioContextResume(
  getContext: () => AudioContext | null,
  options: AudioContextResumeOptions = {},
): () => void {
  const isIos = options.isIos ?? isIosAudioCategoryQuirky();
  const audioFactory = options.audioFactory ?? defaultAudioFactory;

  let armedHandler: (() => void) | null = null;

  function disarm(): void {
    if (armedHandler === null) return;
    for (const event of GESTURE_EVENTS) {
      document.removeEventListener(event, armedHandler);
    }
    armedHandler = null;
  }

  function arm(): void {
    if (armedHandler !== null) return;
    const handler = (): void => {
      disarm();
      const ctx = getContext();
      if (ctx !== null && ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }
      if (isIos) {
        const audio = audioFactory();
        void audio.play().catch(() => {});
      }
    };
    armedHandler = handler;
    for (const event of GESTURE_EVENTS) {
      document.addEventListener(event, handler, { passive: true });
    }
  }

  function tryRecover(): void {
    const ctx = getContext();
    if (ctx === null) return;
    if (ctx.state !== "suspended") return;
    // Best-effort immediate resume — succeeds on browsers that allow it
    // without a user gesture (Chrome desktop, Firefox). On iOS this typically
    // does nothing, hence the gesture-armed fallback below.
    void ctx.resume().catch(() => {});
    arm();
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState !== "visible") return;
    tryRecover();
  }

  function handlePageShow(event: PageTransitionEvent): void {
    // pageshow with persisted=true means we're restoring from bfcache —
    // the page was suspended and is now resumed.
    if (event.persisted) tryRecover();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  return (): void => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
    disarm();
  };
}
