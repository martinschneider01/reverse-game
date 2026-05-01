import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlayer } from "./player";

class FakeBufferSource {
  static instances: FakeBufferSource[] = [];
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  start = vi.fn((_when?: number, _offset?: number) => {});
  stop = vi.fn(() => {});
  disconnect = vi.fn(() => {});
  connect = vi.fn();
  constructor() {
    FakeBufferSource.instances.push(this);
  }
}

class FakeAudioContext {
  destination = {} as AudioDestinationNode;
  currentTime = 0;
  createBufferSource = vi.fn(() => new FakeBufferSource() as unknown as AudioBufferSourceNode);
  resume = vi.fn(async () => {});
  state: AudioContextState = "running";
}

function makeBuffer(length: number, sampleRate = 48000): AudioBuffer {
  return {
    numberOfChannels: 1,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

describe("createPlayer", () => {
  beforeEach(() => {
    FakeBufferSource.instances = [];
  });

  it("play() creates a buffer source, attaches the loaded buffer, connects to destination, and starts", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const buffer = makeBuffer(48000);
    player.load(buffer);

    player.play();

    const source = FakeBufferSource.instances.at(-1)!;
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
    expect(source.buffer).toBe(buffer);
    expect(source.connect).toHaveBeenCalledWith(ctx.destination);
    expect(source.start).toHaveBeenCalled();
  });

  it("play() throws if no buffer has been loaded", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);

    expect(() => player.play()).toThrow(/no buffer/i);
  });

  it("pause() stops the source and disconnects it", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeBuffer(48000));
    player.play();

    const source = FakeBufferSource.instances.at(-1)!;
    player.pause();

    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
  });

  it("pause() with no active source is a no-op", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    expect(() => player.pause()).not.toThrow();
  });

  it("calling play() twice replaces the previous source", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeBuffer(48000));
    player.play();
    const first = FakeBufferSource.instances.at(-1)!;

    player.play();
    const second = FakeBufferSource.instances.at(-1)!;

    expect(first).not.toBe(second);
    expect(first.stop).toHaveBeenCalled();
    expect(first.disconnect).toHaveBeenCalled();
    expect(second.start).toHaveBeenCalled();
  });

  it("onEnded callback fires when the underlying source ends naturally", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const onEnded = vi.fn();
    player.onEnded(onEnded);
    player.load(makeBuffer(48000));
    player.play();

    const source = FakeBufferSource.instances.at(-1)!;
    source.onended?.();

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("onEnded does not fire when pause() stops the source manually", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const onEnded = vi.fn();
    player.onEnded(onEnded);
    player.load(makeBuffer(48000));
    player.play();

    player.pause();

    expect(onEnded).not.toHaveBeenCalled();
  });

  it("load() replaces the buffer used on the next play()", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const a = makeBuffer(1000);
    const b = makeBuffer(2000);
    player.load(a);
    player.play();
    expect(FakeBufferSource.instances.at(-1)!.buffer).toBe(a);

    player.load(b);
    player.play();
    expect(FakeBufferSource.instances.at(-1)!.buffer).toBe(b);
  });

  it("resumes the AudioContext if suspended on play()", () => {
    const ctx = new FakeAudioContext();
    ctx.state = "suspended";
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeBuffer(48000));

    player.play();

    expect(ctx.resume).toHaveBeenCalled();
  });
});
