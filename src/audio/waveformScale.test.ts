import { describe, it, expect } from "vitest";
import {
  initialWaveformScaleState,
  nextWaveformScaleState,
  rmsToBarHeight,
  type WaveformScaleOptions,
} from "./waveformScale";

const NO_FLOOR: WaveformScaleOptions = { floorPeak: 0 };

describe("nextWaveformScaleState", () => {
  it("starts at the floor peak", () => {
    const state = initialWaveformScaleState({ floorPeak: 0.05 });
    expect(state.peak).toBeCloseTo(0.05);
  });

  it("never drops below the configured floor", () => {
    const state = nextWaveformScaleState({ peak: 0.1 }, 0, { floorPeak: 0.05, release: 1 });
    expect(state.peak).toBeCloseTo(0.05);
  });

  it("rises toward instant rms via attack coefficient", () => {
    // attack 0.5 means the peak moves halfway toward the new value in one step
    const state = nextWaveformScaleState({ peak: 0.1 }, 0.5, { attack: 0.5, ...NO_FLOOR });
    expect(state.peak).toBeCloseTo(0.3);
  });

  it("decays slowly via release coefficient when input drops", () => {
    // release 0.1 keeps 90% of the peak each step
    const state = nextWaveformScaleState({ peak: 0.5 }, 0.1, { release: 0.1, ...NO_FLOOR });
    expect(state.peak).toBeCloseTo(0.45);
  });

  it("rises smoothly across multiple frames (no overshoot)", () => {
    let state = initialWaveformScaleState({ floorPeak: 0.01 });
    const frames: number[] = [];
    for (let i = 0; i < 10; i++) {
      state = nextWaveformScaleState(state, 0.6, { attack: 0.2, floorPeak: 0.01 });
      frames.push(state.peak);
    }
    // monotonic non-decreasing ramp
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!).toBeGreaterThanOrEqual(frames[i - 1]!);
    }
    // never overshoots the input
    for (const v of frames) {
      expect(v).toBeLessThanOrEqual(0.6 + 1e-9);
    }
    // converges close to the input within a handful of frames
    expect(frames.at(-1)!).toBeGreaterThan(0.5);
  });

  it("does not flicker when input alternates around the current peak", () => {
    // Once peak settles, small fluctuations under it should produce small,
    // monotonic changes — never a sudden jump in either direction.
    let state: { peak: number } = { peak: 0.4 };
    const peaks: number[] = [];
    for (let i = 0; i < 20; i++) {
      const rms = i % 2 === 0 ? 0.35 : 0.38;
      state = nextWaveformScaleState(state, rms, {
        attack: 0.2,
        release: 0.01,
        floorPeak: 0.01,
      });
      peaks.push(state.peak);
    }
    // No frame-to-frame jump exceeds a small fraction of the peak
    for (let i = 1; i < peaks.length; i++) {
      const delta = Math.abs(peaks[i]! - peaks[i - 1]!);
      expect(delta).toBeLessThan(0.05);
    }
  });
});

describe("rmsToBarHeight", () => {
  it("maps rms equal to peak to the target fraction", () => {
    const h = rmsToBarHeight(0.4, { peak: 0.4 }, { targetFraction: 0.75, minHeight: 0 });
    expect(h).toBeCloseTo(0.75);
  });

  it("returns minHeight when rms is zero", () => {
    const h = rmsToBarHeight(0, { peak: 0.4 }, { minHeight: 0.08 });
    expect(h).toBeCloseTo(0.08);
  });

  it("caps at maxHeight when rms exceeds peak", () => {
    const h = rmsToBarHeight(2, { peak: 0.4 }, { targetFraction: 0.75, maxHeight: 1 });
    expect(h).toBe(1);
  });

  it("respects minHeight even for very small non-zero rms", () => {
    const h = rmsToBarHeight(0.0001, { peak: 0.5 }, { minHeight: 0.08, targetFraction: 0.75 });
    expect(h).toBeCloseTo(0.08);
  });

  it("scales quiet voices to the same visible range as loud voices", () => {
    // Quiet voice: peak settles around 0.05
    const quiet = rmsToBarHeight(0.05, { peak: 0.05 }, { targetFraction: 0.75, minHeight: 0 });
    // Loud voice: peak settles around 0.5
    const loud = rmsToBarHeight(0.5, { peak: 0.5 }, { targetFraction: 0.75, minHeight: 0 });
    // Both should reach the same visible height at their respective peaks
    expect(quiet).toBeCloseTo(loud);
    expect(quiet).toBeCloseTo(0.75);
  });
});
