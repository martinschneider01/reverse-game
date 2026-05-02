import { create } from "zustand";

export type PwaState = {
  // Set to true when a new service worker has been installed and is waiting.
  // The UpdatePrompt banner subscribes to this and shows a "Recharger" CTA.
  needsRefresh: boolean;
  setNeedsRefresh: (value: boolean) => void;

  // The acceptUpdate action calls into the SW to skipWaiting + reload.
  // Wired by the PWA registration module on app boot. Defaults to a no-op
  // so that tests / non-PWA environments don't blow up.
  acceptUpdate: () => Promise<void>;
  setAcceptUpdate: (fn: () => Promise<void>) => void;
};

export const INITIAL_PWA_STATE: Pick<PwaState, "needsRefresh"> = {
  needsRefresh: false,
};

export const usePwaStore = create<PwaState>((set) => ({
  ...INITIAL_PWA_STATE,
  acceptUpdate: async () => {},
  setNeedsRefresh: (value) => set({ needsRefresh: value }),
  setAcceptUpdate: (fn) => set({ acceptUpdate: fn }),
}));
