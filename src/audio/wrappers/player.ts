import type { Direction, Recording } from "@/audio/recording";

export type Player = {
  load: (recording: Recording) => void;
  play: () => void;
  pause: () => void;
  setRate: (rate: number) => void;
  setDirection: (direction: Direction) => void;
  onEnded: (callback: () => void) => void;
};

export function createPlayer(audioContext: AudioContext): Player {
  let recording: Recording | null = null;
  let source: AudioBufferSourceNode | null = null;
  let endedCallback: (() => void) | null = null;
  let rate = 1;
  let direction: Direction = "forward";

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

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    const node = audioContext.createBufferSource();
    node.buffer = direction === "forward" ? recording.forward : recording.reverse;
    node.playbackRate.value = rate;
    node.connect(audioContext.destination);
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

    onEnded(callback: () => void) {
      endedCallback = callback;
    },
  };
}
