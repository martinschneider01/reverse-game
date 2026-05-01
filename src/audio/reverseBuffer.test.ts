import { describe, it, expect } from "vitest";
import { reverseBuffer } from "./reverseBuffer";

type ChannelData = ReadonlyArray<readonly number[]>;

function makeBuffer(channels: ChannelData, sampleRate: number): AudioBuffer {
  const data = channels.map((c) => Float32Array.from(c));
  const length = data[0]?.length ?? 0;
  const ctx: Partial<AudioBuffer> = {
    numberOfChannels: data.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(channel: number) {
      const arr = data[channel];
      if (arr === undefined) {
        throw new Error(`Channel ${channel} out of range`);
      }
      return arr;
    },
  };
  return ctx as AudioBuffer;
}

function recordCreateBuffer(): {
  factory: (channels: number, length: number, sampleRate: number) => AudioBuffer;
  calls: Array<{ channels: number; length: number; sampleRate: number }>;
} {
  const calls: Array<{ channels: number; length: number; sampleRate: number }> = [];
  const factory = (channels: number, length: number, sampleRate: number): AudioBuffer => {
    calls.push({ channels, length, sampleRate });
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const buf: Partial<AudioBuffer> = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel: number) => {
        const arr = data[channel];
        if (arr === undefined) {
          throw new Error(`Channel ${channel} out of range`);
        }
        return arr;
      },
    };
    return buf as AudioBuffer;
  };
  return { factory, calls };
}

function readChannel(buffer: AudioBuffer, channel: number): number[] {
  return Array.from(buffer.getChannelData(channel));
}

describe("reverseBuffer", () => {
  it("reverses a mono buffer of even length", () => {
    const { factory } = recordCreateBuffer();
    const source = makeBuffer([[1, 2, 3, 4]], 48000);

    const reversed = reverseBuffer(source, factory);

    expect(readChannel(reversed, 0)).toEqual([4, 3, 2, 1]);
  });

  it("reverses a mono buffer of odd length", () => {
    const { factory } = recordCreateBuffer();
    const source = makeBuffer([[10, 20, 30, 40, 50]], 44100);

    const reversed = reverseBuffer(source, factory);

    expect(readChannel(reversed, 0)).toEqual([50, 40, 30, 20, 10]);
  });

  it("reverses a single-sample buffer (no-op result)", () => {
    const { factory } = recordCreateBuffer();
    const source = makeBuffer([[42]], 48000);

    const reversed = reverseBuffer(source, factory);

    expect(readChannel(reversed, 0)).toEqual([42]);
  });

  it("reverses each channel independently for a stereo buffer", () => {
    const { factory } = recordCreateBuffer();
    const source = makeBuffer(
      [
        [1, 2, 3, 4],
        [9, 8, 7, 6],
      ],
      48000,
    );

    const reversed = reverseBuffer(source, factory);

    expect(readChannel(reversed, 0)).toEqual([4, 3, 2, 1]);
    expect(readChannel(reversed, 1)).toEqual([6, 7, 8, 9]);
  });

  it("preserves sampleRate, channel count, and length", () => {
    const { factory, calls } = recordCreateBuffer();
    const source = makeBuffer(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      22050,
    );

    const reversed = reverseBuffer(source, factory);

    expect(reversed.numberOfChannels).toBe(2);
    expect(reversed.length).toBe(3);
    expect(reversed.sampleRate).toBe(22050);
    expect(calls).toEqual([{ channels: 2, length: 3, sampleRate: 22050 }]);
  });

  it("does not mutate the source buffer", () => {
    const { factory } = recordCreateBuffer();
    const source = makeBuffer([[1, 2, 3, 4]], 48000);

    reverseBuffer(source, factory);

    expect(readChannel(source, 0)).toEqual([1, 2, 3, 4]);
  });

  it("uses the AudioContext's createBuffer when no factory is provided", () => {
    const { factory, calls } = recordCreateBuffer();
    const ctx = { createBuffer: factory } as unknown as AudioContext;
    const source = makeBuffer([[1, 2, 3, 4]], 48000);

    const reversed = reverseBuffer(source, ctx);

    expect(calls).toEqual([{ channels: 1, length: 4, sampleRate: 48000 }]);
    expect(readChannel(reversed, 0)).toEqual([4, 3, 2, 1]);
  });
});
