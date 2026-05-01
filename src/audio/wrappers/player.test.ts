import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlayer } from "./player";
import type { Recording } from "@/audio/recording";

class FakeAudioParam {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
}

class FakeBufferSource {
  static instances: FakeBufferSource[] = [];
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  playbackRate = new FakeAudioParam(1);
  start = vi.fn((_when?: number, _offset?: number) => {});
  stop = vi.fn(() => {});
  disconnect = vi.fn(() => {});
  connect = vi.fn();
  constructor() {
    FakeBufferSource.instances.push(this);
  }
}

class FakeGainNode {
  static instances: FakeGainNode[] = [];
  gain = new FakeAudioParam(1);
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    FakeGainNode.instances.push(this);
  }
}

class FakeAudioContext {
  destination = {} as AudioDestinationNode;
  currentTime = 0;
  createBufferSource = vi.fn(() => new FakeBufferSource() as unknown as AudioBufferSourceNode);
  createGain = vi.fn(() => new FakeGainNode() as unknown as GainNode);
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

function makeRecording(length = 48000): Recording {
  return {
    forward: makeBuffer(length),
    reverse: makeBuffer(length),
    durationMs: 1000,
    blob: new Blob(),
  };
}

describe("createPlayer", () => {
  beforeEach(() => {
    FakeBufferSource.instances = [];
    FakeGainNode.instances = [];
  });

  it("play() creates a buffer source, routes it through the GainNode, and starts", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const rec = makeRecording();
    player.load(rec);

    player.play();

    const source = FakeBufferSource.instances.at(-1)!;
    const gain = FakeGainNode.instances.at(-1)!;
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
    expect(source.buffer).toBe(rec.forward);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(source.start).toHaveBeenCalled();
  });

  it("play() throws if no recording has been loaded", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);

    expect(() => player.play()).toThrow(/no recording/i);
  });

  it("pause() stops the source and disconnects it", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());
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
    player.load(makeRecording());
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
    player.load(makeRecording());
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
    player.load(makeRecording());
    player.play();

    player.pause();

    expect(onEnded).not.toHaveBeenCalled();
  });

  it("load() replaces the recording used on the next play()", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const a = makeRecording();
    const b = makeRecording();
    player.load(a);
    player.play();
    expect(FakeBufferSource.instances.at(-1)!.buffer).toBe(a.forward);

    player.load(b);
    player.play();
    expect(FakeBufferSource.instances.at(-1)!.buffer).toBe(b.forward);
  });

  it("resumes the AudioContext if suspended on play()", () => {
    const ctx = new FakeAudioContext();
    ctx.state = "suspended";
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());

    player.play();

    expect(ctx.resume).toHaveBeenCalled();
  });

  it("setRate before play() applies to the next source's playbackRate", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());
    player.setRate(0.5);

    player.play();

    const source = FakeBufferSource.instances.at(-1)!;
    expect(source.playbackRate.value).toBe(0.5);
  });

  it("setRate during playback updates the live source's playbackRate without restarting", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());
    player.play();
    const source = FakeBufferSource.instances.at(-1)!;

    player.setRate(2);

    expect(source.playbackRate.value).toBe(2);
    expect(FakeBufferSource.instances).toHaveLength(1);
    expect(source.stop).not.toHaveBeenCalled();
  });

  it("setDirection('reverse') before play() makes the next play use the reverse buffer", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const rec = makeRecording();
    player.load(rec);
    player.setDirection("reverse");

    player.play();

    expect(FakeBufferSource.instances.at(-1)!.buffer).toBe(rec.reverse);
  });

  it("setDirection during playback swaps the active buffer by replacing the source", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const rec = makeRecording();
    player.load(rec);
    player.play();
    const first = FakeBufferSource.instances.at(-1)!;
    expect(first.buffer).toBe(rec.forward);

    player.setDirection("reverse");

    const second = FakeBufferSource.instances.at(-1)!;
    expect(second).not.toBe(first);
    expect(first.stop).toHaveBeenCalled();
    expect(first.disconnect).toHaveBeenCalled();
    expect(second.buffer).toBe(rec.reverse);
    expect(second.start).toHaveBeenCalled();
  });

  it("setDirection during playback preserves the current rate", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());
    player.setRate(0.75);
    player.play();

    player.setDirection("reverse");

    expect(FakeBufferSource.instances.at(-1)!.playbackRate.value).toBe(0.75);
  });

  it("setDirection while paused does not start playback", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());

    player.setDirection("reverse");

    expect(FakeBufferSource.instances).toHaveLength(0);
  });

  it("setting the same direction during playback is a no-op (no source recreated)", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());
    player.play();

    player.setDirection("forward");

    expect(FakeBufferSource.instances).toHaveLength(1);
  });

  it("onEnded is not fired when setDirection replaces the source mid-playback", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const onEnded = vi.fn();
    player.onEnded(onEnded);
    player.load(makeRecording());
    player.play();

    player.setDirection("reverse");

    expect(onEnded).not.toHaveBeenCalled();
  });

  it("creates a single GainNode connected to the destination at construction", () => {
    const ctx = new FakeAudioContext();
    createPlayer(ctx as unknown as AudioContext);

    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    const gain = FakeGainNode.instances.at(-1)!;
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it("defaults the gain value to 1.0 when no options are provided", () => {
    const ctx = new FakeAudioContext();
    createPlayer(ctx as unknown as AudioContext);

    const gain = FakeGainNode.instances.at(-1)!;
    expect(gain.gain.value).toBe(1);
  });

  it("applies the configured initial gain from options", () => {
    const ctx = new FakeAudioContext();
    createPlayer(ctx as unknown as AudioContext, { gain: 1.5 });

    const gain = FakeGainNode.instances.at(-1)!;
    expect(gain.gain.value).toBe(1.5);
  });

  it("setGain() updates the GainNode value live", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    const gain = FakeGainNode.instances.at(-1)!;

    player.setGain(2);

    expect(gain.gain.value).toBe(2);
  });

  it("reuses the same GainNode across successive play() calls", () => {
    const ctx = new FakeAudioContext();
    const player = createPlayer(ctx as unknown as AudioContext);
    player.load(makeRecording());

    player.play();
    player.play();

    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    const gain = FakeGainNode.instances.at(-1)!;
    expect(FakeBufferSource.instances).toHaveLength(2);
    for (const s of FakeBufferSource.instances) {
      expect(s.connect).toHaveBeenCalledWith(gain);
    }
  });
});
