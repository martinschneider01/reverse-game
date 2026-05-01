export type Player = {
  load: (buffer: AudioBuffer) => void;
  play: () => void;
  pause: () => void;
  onEnded: (callback: () => void) => void;
};

export function createPlayer(audioContext: AudioContext): Player {
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let endedCallback: (() => void) | null = null;

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

  return {
    load(b: AudioBuffer) {
      buffer = b;
    },

    play() {
      if (buffer === null) {
        throw new Error("No buffer loaded");
      }
      disposeSource();

      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const node = audioContext.createBufferSource();
      node.buffer = buffer;
      node.connect(audioContext.destination);
      node.onended = () => {
        if (source === node) {
          source = null;
          endedCallback?.();
        }
      };
      source = node;
      node.start();
    },

    pause() {
      disposeSource();
    },

    onEnded(callback: () => void) {
      endedCallback = callback;
    },
  };
}
