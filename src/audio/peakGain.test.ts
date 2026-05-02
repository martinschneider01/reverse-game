import { describe, it, expect } from "vitest";
import { computePeakGain } from "./peakGain";

function bufferFrom(channels: number[][]): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  const data = channels.map((c) => Float32Array.from(c));
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate: 48000,
    duration: length / 48000,
    getChannelData: (i: number) => data[i] ?? new Float32Array(0),
  } as unknown as AudioBuffer;
}

describe("computePeakGain", () => {
  it("returns 1 for a silent buffer", () => {
    const buf = bufferFrom([[0, 0, 0, 0]]);
    expect(computePeakGain(buf)).toBe(1);
  });

  it("returns 1 when the peak already exceeds the target (no attenuation by default)", () => {
    const buf = bufferFrom([[0.99, -0.5, 0.7]]);
    expect(computePeakGain(buf)).toBe(1);
  });

  it("boosts a quiet buffer toward the target peak", () => {
    const buf = bufferFrom([[0.2, -0.1, 0.15]]);
    expect(computePeakGain(buf)).toBeCloseTo(0.95 / 0.2, 5);
  });

  it("respects negative samples when computing the peak", () => {
    const buf = bufferFrom([[-0.2, 0.05, -0.1]]);
    expect(computePeakGain(buf)).toBeCloseTo(0.95 / 0.2, 5);
  });

  it("clamps to the maximum gain for near-silent buffers", () => {
    const buf = bufferFrom([[0.001, -0.0005]]);
    expect(computePeakGain(buf)).toBe(8);
  });

  it("scans every channel and uses the loudest peak across them", () => {
    const buf = bufferFrom([
      [0.05, 0.05, 0.05],
      [0.4, -0.4, 0.0],
    ]);
    expect(computePeakGain(buf)).toBeCloseTo(0.95 / 0.4, 5);
  });

  it("honors a custom target peak", () => {
    const buf = bufferFrom([[0.1]]);
    expect(computePeakGain(buf, { targetPeak: 0.5 })).toBeCloseTo(0.5 / 0.1, 5);
  });

  it("honors a custom maxGain ceiling", () => {
    const buf = bufferFrom([[0.001]]);
    expect(computePeakGain(buf, { maxGain: 2 })).toBe(2);
  });

  it("honors a custom minGain floor (allows attenuation when set below 1)", () => {
    const buf = bufferFrom([[1, -1]]);
    expect(computePeakGain(buf, { minGain: 0.5 })).toBeCloseTo(0.95, 5);
  });

  it("returns 1 when the buffer can't expose channel data", () => {
    const buf = { numberOfChannels: 1, length: 0, sampleRate: 48000 } as unknown as AudioBuffer;
    expect(computePeakGain(buf)).toBe(1);
  });
});
