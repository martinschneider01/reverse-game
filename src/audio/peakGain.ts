// Peak-normalization gain for a recorded AudioBuffer.
//
// Why: recordings made far from the mic or with a soft voice play back too
// quietly because the player runs at unity gain. Scanning the buffer for its
// loudest sample gives us a per-recording multiplier that lifts quiet takes
// toward a target peak without touching takes that are already loud enough.

export type ComputePeakGainOptions = {
  // Target peak amplitude in [0, 1]. The returned gain aims to push the
  // buffer's loudest sample to this value. Default 0.95 — leaves a touch of
  // headroom below clipping.
  targetPeak?: number;
  // Upper bound on the multiplier so near-silent buffers (mostly noise floor)
  // don't get amplified into a wall of hiss. Default 8 (~+18 dB).
  maxGain?: number;
  // Lower bound — defaults to 1 so loud recordings are left alone rather than
  // attenuated.
  minGain?: number;
};

const DEFAULT_TARGET_PEAK = 0.95;
const DEFAULT_MAX_GAIN = 8;
const DEFAULT_MIN_GAIN = 1;

export function computePeakGain(buffer: AudioBuffer, options: ComputePeakGainOptions = {}): number {
  const target = options.targetPeak ?? DEFAULT_TARGET_PEAK;
  const maxGain = options.maxGain ?? DEFAULT_MAX_GAIN;
  const minGain = options.minGain ?? DEFAULT_MIN_GAIN;

  if (typeof buffer.getChannelData !== "function") return 1;

  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = data[i] ?? 0;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
  }

  if (peak === 0) return 1;
  const gain = target / peak;
  if (gain < minGain) return minGain;
  if (gain > maxGain) return maxGain;
  return gain;
}
