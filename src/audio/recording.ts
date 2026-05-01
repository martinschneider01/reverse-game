export type Direction = "forward" | "reverse";

export type Recording = {
  forward: AudioBuffer;
  reverse: AudioBuffer;
  durationMs: number;
};
