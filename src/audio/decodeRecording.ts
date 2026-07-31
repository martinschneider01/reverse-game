// iOS Safari has a long-standing WebKit bug where `decodeAudioData` rejects
// with a generic "Decoding failed" error for perfectly playable MediaRecorder
// audio/mp4 blobs — the container plays fine through an <audio> element, just
// not through the Web Audio decoder. When that happens we fall back to
// playing the blob through a muted <audio> element wired into the real-time
// AudioContext and capturing the PCM samples as they play, which sidesteps
// the broken decoder entirely.
const FALLBACK_CHANNELS = 2;
const FALLBACK_PROCESSOR_BUFFER_SIZE = 4096;

export type DecodeRecordingOptions = {
  audioElementFactory?: () => HTMLAudioElement;
};

export async function decodeRecording(
  blob: Blob,
  audioContext: AudioContext,
  options: DecodeRecordingOptions = {},
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (primaryErr) {
    try {
      return await decodeViaPlayback(blob, audioContext, options.audioElementFactory);
    } catch {
      throw primaryErr instanceof Error ? primaryErr : new Error(String(primaryErr));
    }
  }
}

function decodeViaPlayback(
  blob: Blob,
  audioContext: AudioContext,
  audioElementFactory: () => HTMLAudioElement = () => new Audio(),
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    if (
      typeof audioContext.createMediaElementSource !== "function" ||
      typeof audioContext.createScriptProcessor !== "function" ||
      typeof audioContext.createGain !== "function" ||
      typeof URL.createObjectURL !== "function"
    ) {
      reject(new Error("Playback-based decode fallback is unavailable"));
      return;
    }

    const url = URL.createObjectURL(blob);
    const audioEl = audioElementFactory();
    audioEl.muted = true;

    const chunks: Float32Array[][] = Array.from({ length: FALLBACK_CHANNELS }, () => []);
    let frameCount = 0;
    let settled = false;

    let source: MediaElementAudioSourceNode;
    let processor: ScriptProcessorNode;
    let mute: GainNode;
    try {
      source = audioContext.createMediaElementSource(audioEl);
      processor = audioContext.createScriptProcessor(
        FALLBACK_PROCESSOR_BUFFER_SIZE,
        FALLBACK_CHANNELS,
        FALLBACK_CHANNELS,
      );
      mute = audioContext.createGain();
      mute.gain.value = 0;
    } catch (err) {
      URL.revokeObjectURL(url);
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    function cleanup(): void {
      processor.onaudioprocess = null;
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
      try {
        processor.disconnect();
      } catch {
        // already disconnected
      }
      try {
        mute.disconnect();
      } catch {
        // already disconnected
      }
      URL.revokeObjectURL(url);
    }

    function fail(err: unknown): void {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    function finish(): void {
      if (settled) return;
      settled = true;
      cleanup();
      const length = Math.max(frameCount, 1);
      const buffer = audioContext.createBuffer(FALLBACK_CHANNELS, length, audioContext.sampleRate);
      for (let ch = 0; ch < FALLBACK_CHANNELS; ch++) {
        const data = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks[ch] ?? []) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        buffer.copyToChannel(data, ch);
      }
      resolve(buffer);
    }

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      for (let ch = 0; ch < FALLBACK_CHANNELS; ch++) {
        chunks[ch]?.push(new Float32Array(event.inputBuffer.getChannelData(ch)));
      }
      frameCount += event.inputBuffer.length;
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(audioContext.destination);

    audioEl.addEventListener("ended", finish, { once: true });
    audioEl.addEventListener("error", () => fail(new Error("Decoding failed")), { once: true });
    audioEl.src = url;
    void audioEl.play().catch(fail);
  });
}
