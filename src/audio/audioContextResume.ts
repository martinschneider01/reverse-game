// AudioContext recovery after the page returns from background — issue #20
// and follow-up.
//
// On iOS, when the screen locks or the user switches apps/tabs, three things
// happen that defeat audio playback:
//   1. The AudioContext is suspended (or moves to the iOS-specific
//      "interrupted" state). AudioContext.resume() outside a user gesture is
//      a no-op on iOS, so calling it from a visibilitychange handler may not
//      actually resume.
//   2. The AVAudioSession category drifts back to "ambient" / "ringer". Even
//      if the context resumes, output is silent or near-silent until a
//      <audio> element is played to re-prime the session category.
//   3. Neither visibilitychange nor pageshow always fires on screen
//      lock/unlock — the page can stay "visible" the whole time, with only
//      the AudioContext state and AVAudioSession category drifting.
//
// Recovery strategy: arm a one-shot user-gesture listener whenever any of
// the following happens — visibilitychange to visible, pageshow, or
// AudioContext statechange to non-running. The handler re-runs resume() and
// (on iOS) replays a silent WAV. The user's next interaction triggers
// recovery; the click handler on the play button then sees a running
// context. (The AudioPlayer also primes the session on every play tap as a
// belt-and-braces guard, since case 2 can happen without any state change.)

import { defaultSilentAudioFactory, isIosAudioCategoryQuirky } from "./iosAudioUnlock";

const GESTURE_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "pointerdown",
  "touchstart",
  "keydown",
];

// AudioContext can also be in the iOS-only "interrupted" state, which is not
// part of the standard AudioContextState union — hence the cast.
function isContextRecoverable(ctx: AudioContext): boolean {
  const state = ctx.state as string;
  return state !== "running" && state !== "closed";
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
  const audioFactory = options.audioFactory ?? defaultSilentAudioFactory;

  let armedHandler: (() => void) | null = null;
  let watchedContext: AudioContext | null = null;

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
      if (ctx !== null && isContextRecoverable(ctx)) {
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

  function watchContextState(ctx: AudioContext): void {
    if (watchedContext === ctx) return;
    watchedContext = ctx;
    ctx.addEventListener("statechange", handleStateChange);
  }

  function handleStateChange(): void {
    const ctx = watchedContext;
    if (ctx === null) return;
    if (isContextRecoverable(ctx)) arm();
  }

  function tryRecover(): void {
    const ctx = getContext();
    if (ctx === null) return;
    watchContextState(ctx);
    if (!isContextRecoverable(ctx)) return;
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

  function handlePageShow(): void {
    // We don't gate on event.persisted — on iOS, lock/unlock can leave the
    // AudioContext suspended without a bfcache restore, and the harmless
    // tryRecover() call on initial load is gated by getContext()/state checks.
    tryRecover();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  return (): void => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
    if (watchedContext !== null) {
      watchedContext.removeEventListener("statechange", handleStateChange);
      watchedContext = null;
    }
    disarm();
  };
}
