// Service-worker registration with explicit "new version" prompt.
//
// Why not the default `registerType: 'autoUpdate'` flow? Because autoUpdate
// silently installs the new SW and skipsWaiting, but the live tab keeps
// running the old JS bundle in memory and the old precached HTML/CSS until
// the user manually reloads — so updates land sporadically. The prompt
// flow surfaces a banner the user can act on.
//
// What this module does:
//   1. Calls registerSW from virtual:pwa-register, passing onNeedRefresh
//      to flip a store flag — UpdatePrompt subscribes to that flag.
//   2. Wires acceptUpdate(): updateSW(true) sends skipWaiting to the
//      waiting SW, waits for it to take control, then reloads the page.
//   3. Periodically asks the registration to check for updates, and on
//      every visibilitychange→visible. Without this, browsers may not
//      check sw.js for hours, especially on iOS PWAs added to home screen.

import { registerSW } from "virtual:pwa-register";
import { usePwaStore } from "@/store/pwaStore";

// Update-check cadence while the page is open. 60s is aggressive enough
// to catch a deploy within a minute, cheap enough not to matter.
const UPDATE_CHECK_INTERVAL_MS = 60_000;

export type RegisterServiceWorkerOptions = {
  // Callable returning a "now" timestamp; injected by tests.
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}): () => void {
  const setIntervalImpl = options.setIntervalFn ?? setInterval;
  const clearIntervalImpl = options.clearIntervalFn ?? clearInterval;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;

  const updateSW = registerSW({
    onNeedRefresh() {
      usePwaStore.getState().setNeedsRefresh(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration === undefined) return;

      intervalId = setIntervalImpl(() => {
        void registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);

      visibilityHandler = (): void => {
        if (document.visibilityState !== "visible") return;
        void registration.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", visibilityHandler);
    },
  });

  usePwaStore.getState().setAcceptUpdate(async () => {
    // updateSW(true) posts skipWaiting to the waiting SW and reloads when
    // the new SW takes control of the page.
    await updateSW(true);
  });

  return (): void => {
    if (intervalId !== null) {
      clearIntervalImpl(intervalId);
      intervalId = null;
    }
    if (visibilityHandler !== null) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
  };
}
