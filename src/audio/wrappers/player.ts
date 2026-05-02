import type { Direction, Recording } from "@/audio/recording";

export type Player = {
  load: (recording: Recording) => void;
  play: () => void;
  pause: () => void;
  setRate: (rate: number) => void;
  setDirection: (direction: Direction) => void;
  setGain: (gain: number) => void;
  onEnded: (callback: () => void) => void;
};

export type PlayerOptions = {
  // Multiplier applied between the buffer source and destination.
  // Default 1.0 (unity gain). Issue #18: a GainNode in the chain lets callers
  // boost output above the buffer's native level on devices where Web Audio
  // routing produces a quieter signal than HTMLAudioElement.
  gain?: number;
};

const DEFAULT_GAIN = 1;

export function createPlayer(audioContext: AudioContext, options: PlayerOptions = {}): Player {
  let recording: Recording | null = null;
  let source: AudioBufferSourceNode | null = null;
  let endedCallback: (() => void) | null = null;
  let rate = 1;
  let direction: Direction = "forward";

  const gainNode = audioContext.createGain();
  gainNode.gain.value = options.gain ?? DEFAULT_GAIN;
  gainNode.connect(audioContext.destination);

  function disposeSource(): void {
    if (source !== null) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
      source.disconnect();
      source = null;
    }
  }

  function startSource(): void {
    if (recording === null) {
      throw new Error("No recording loaded");
    }
    disposeSource();

    // Cover both "suspended" and the iOS-specific "interrupted" state — any
    // non-running, non-closed state needs resume() before start().
    if (
      (audioContext.state as string) !== "running" &&
      (audioContext.state as string) !== "closed"
    ) {
      void audioContext.resume();
    }

    const node = audioContext.createBufferSource();
    node.buffer = direction === "forward" ? recording.forward : recording.reverse;
    node.playbackRate.value = rate;
    node.connect(gainNode);
    node.onended = () => {
      if (source === node) {
        source = null;
        endedCallback?.();
      }
    };
    source = node;
    node.start();
  }

  return {
    load(r: Recording) {
      recording = r;
    },

    play() {
      startSource();
    },

    pause() {
      disposeSource();
    },

    setRate(newRate: number) {
      rate = newRate;
      if (source !== null) {
        source.playbackRate.value = newRate;
      }
    },

    setDirection(newDirection: Direction) {
      if (newDirection === direction) return;
      direction = newDirection;
      if (source !== null) {
        startSource();
      }
    },

    setGain(newGain: number) {
      gainNode.gain.value = newGain;
    },

    onEnded(callback: () => void) {
      endedCallback = callback;
    },
  };
}
