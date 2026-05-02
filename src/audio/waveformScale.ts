// Adaptive scaling for the live recording waveform.
//
// Why: a fixed gain factor leaves quiet voices invisible and lets loud voices
// clip the bars at full height for most of the recording. We track a rolling
// peak with smooth attack/slow release and divide each bar's RMS by that peak
// so the loudest moment of the current recording maps to a target fraction of
// the bar's height — independent of absolute volume.

const DEFAULT_TARGET_FRACTION = 0.75;
const DEFAULT_FLOOR_PEAK = 0.02;
const DEFAULT_ATTACK = 0.15;
const DEFAULT_RELEASE = 0.003;
const DEFAULT_MIN_HEIGHT = 0;
const DEFAULT_MAX_HEIGHT = 1;

export type WaveformScaleState = {
  peak: number;
};

export type WaveformScaleOptions = {
  targetFraction?: number;
  floorPeak?: number;
  attack?: number;
  release?: number;
};

export type BarHeightOptions = {
  targetFraction?: number;
  minHeight?: number;
  maxHeight?: number;
};

export function initialWaveformScaleState(options?: WaveformScaleOptions): WaveformScaleState {
  return { peak: options?.floorPeak ?? DEFAULT_FLOOR_PEAK };
}

export function nextWaveformScaleState(
  prev: WaveformScaleState,
  instantRms: number,
  options?: WaveformScaleOptions,
): WaveformScaleState {
  const floor = options?.floorPeak ?? DEFAULT_FLOOR_PEAK;
  const attack = options?.attack ?? DEFAULT_ATTACK;
  const release = options?.release ?? DEFAULT_RELEASE;

  let next: number;
  if (instantRms > prev.peak) {
    next = prev.peak + (instantRms - prev.peak) * attack;
  } else {
    next = prev.peak - prev.peak * release;
  }
  return { peak: Math.max(floor, next) };
}

export function rmsToBarHeight(
  rms: number,
  state: WaveformScaleState,
  options?: BarHeightOptions,
): number {
  const target = options?.targetFraction ?? DEFAULT_TARGET_FRACTION;
  const minH = options?.minHeight ?? DEFAULT_MIN_HEIGHT;
  const maxH = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  if (rms <= 0 || state.peak <= 0) return minH;
  const scaled = (rms / state.peak) * target;
  return Math.min(maxH, Math.max(minH, scaled));
}
