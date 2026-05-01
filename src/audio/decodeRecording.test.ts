import { describe, it, expect, vi } from "vitest";
import { decodeRecording } from "./decodeRecording";

function makeAudioBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

function makeContextWithDecode(decode: (data: ArrayBuffer) => Promise<AudioBuffer>): AudioContext {
  return {
    decodeAudioData: vi.fn(decode),
  } as unknown as AudioContext;
}

describe("decodeRecording", () => {
  it("decodes a Blob into an AudioBuffer using the provided AudioContext", async () => {
    const expected = makeAudioBuffer(1, 8, 48000);
    const blob = new Blob([new Uint8Array([0xff, 0x00, 0xab, 0xcd])], {
      type: "audio/webm",
    });
    const ctx = makeContextWithDecode(async () => expected);

    const result = await decodeRecording(blob, ctx);

    expect(result).toBe(expected);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it("passes the blob's bytes (as ArrayBuffer) to decodeAudioData", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const blob = new Blob([bytes], { type: "audio/webm" });
    let received: ArrayBuffer | null = null;
    const ctx = makeContextWithDecode(async (data) => {
      received = data;
      return makeAudioBuffer(2, 4, 44100);
    });

    await decodeRecording(blob, ctx);

    expect(received).not.toBeNull();
    expect(new Uint8Array(received!)).toEqual(bytes);
  });

  it("works for stereo buffers", async () => {
    const expected = makeAudioBuffer(2, 16, 44100);
    const blob = new Blob([new Uint8Array([0])], { type: "audio/webm" });
    const ctx = makeContextWithDecode(async () => expected);

    const result = await decodeRecording(blob, ctx);

    expect(result.numberOfChannels).toBe(2);
    expect(result).toBe(expected);
  });

  it("rejects when the AudioContext fails to decode", async () => {
    const blob = new Blob([new Uint8Array([0])], { type: "audio/webm" });
    const ctx = makeContextWithDecode(async () => {
      throw new Error("EncodingError: bad bytes");
    });

    await expect(decodeRecording(blob, ctx)).rejects.toThrow(/EncodingError/);
  });

  it("rejects when the Blob cannot be read as an ArrayBuffer", async () => {
    const broken = {
      arrayBuffer: () => Promise.reject(new Error("read failed")),
    } as unknown as Blob;
    const ctx = makeContextWithDecode(async () => makeAudioBuffer(1, 1, 44100));

    await expect(decodeRecording(broken, ctx)).rejects.toThrow(/read failed/);
    expect(ctx.decodeAudioData).not.toHaveBeenCalled();
  });
});
