import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  describe("playback-based fallback (iOS Safari decodeAudioData failures)", () => {
    function makeFakeAudioElement() {
      const listeners: Record<string, Array<() => void>> = {};
      const el = {
        muted: false,
        src: "",
        addEventListener: (type: string, cb: () => void) => {
          (listeners[type] ??= []).push(cb);
        },
        removeEventListener: () => {},
        play: vi.fn(() => Promise.resolve()),
      } as unknown as HTMLAudioElement;
      return {
        el,
        triggerEnded: () => listeners["ended"]?.forEach((cb) => cb()),
        triggerError: () => listeners["error"]?.forEach((cb) => cb()),
      };
    }

    function makeFallbackContext(primaryDecode: () => Promise<AudioBuffer>) {
      const source = { connect: vi.fn(), disconnect: vi.fn() };
      const processor: {
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
        onaudioprocess: ((event: unknown) => void) | null;
      } = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      };
      const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
      const ctx = {
        decodeAudioData: vi.fn(primaryDecode),
        sampleRate: 44100,
        destination: {},
        createMediaElementSource: vi.fn(() => source),
        createScriptProcessor: vi.fn(() => processor),
        createGain: vi.fn(() => gain),
        createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
          const channelData: Float32Array[] = Array.from(
            { length: channels },
            () => new Float32Array(length),
          );
          return {
            numberOfChannels: channels,
            length,
            sampleRate,
            copyToChannel: (data: Float32Array, ch: number) => channelData[ch]?.set(data),
            getChannelData: (ch: number) => channelData[ch],
          } as unknown as AudioBuffer;
        }),
      } as unknown as AudioContext;
      return { ctx, processor };
    }

    async function waitUntil(condition: () => boolean, timeoutMs = 1000): Promise<void> {
      const start = Date.now();
      while (!condition()) {
        if (Date.now() - start > timeoutMs) {
          throw new Error("waitUntil: condition never became true");
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    beforeEach(() => {
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => "blob:http://test/fallback"),
        revokeObjectURL: vi.fn(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("captures samples played through an <audio> element when decodeAudioData rejects", async () => {
      const blob = new Blob([new Uint8Array([0])], { type: "audio/mp4" });
      const { ctx, processor } = makeFallbackContext(async () => {
        throw new Error("Decoding failed");
      });
      const { el, triggerEnded } = makeFakeAudioElement();

      const resultPromise = decodeRecording(blob, ctx, { audioElementFactory: () => el });

      // Let the primary decodeAudioData rejection propagate and the fallback
      // Promise executor run (it wires everything up synchronously once reached).
      await waitUntil(() => processor.onaudioprocess !== null);

      const fakeInputBuffer = {
        length: 3,
        getChannelData: () => new Float32Array([0.5, -0.5, 0.25]),
      };
      processor.onaudioprocess?.({ inputBuffer: fakeInputBuffer });
      triggerEnded();

      const result = await resultPromise;
      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(3);
      expect(Array.from(result.getChannelData(0))).toEqual([0.5, -0.5, 0.25]);
    });

    it("rejects with the original decodeAudioData error when the fallback also fails", async () => {
      const blob = new Blob([new Uint8Array([0])], { type: "audio/mp4" });
      const { ctx, processor } = makeFallbackContext(async () => {
        throw new Error("Decoding failed");
      });
      const { el, triggerError } = makeFakeAudioElement();

      const resultPromise = decodeRecording(blob, ctx, { audioElementFactory: () => el });

      await waitUntil(() => processor.onaudioprocess !== null);
      triggerError();

      await expect(resultPromise).rejects.toThrow(/Decoding failed/);
    });
  });
});
