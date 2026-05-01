export type Direction = "forward" | "reverse";

export type Recording = {
  forward: AudioBuffer;
  reverse: AudioBuffer;
  durationMs: number;
  // Source Opus/WebM blob retained so the recording can be persisted to
  // IndexedDB and rehydrated after a page unload (mobile browsers drop
  // backgrounded PWAs after a few minutes; AudioBuffers don't survive that).
  blob: Blob;
};
