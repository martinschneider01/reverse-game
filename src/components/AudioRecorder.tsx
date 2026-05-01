import { useEffect, useRef, useState } from "react";
import { createRecorder, type Recorder, type RecorderOptions } from "@/audio/wrappers/recorder";
import { decodeRecording } from "@/audio/decodeRecording";
import { reverseBuffer } from "@/audio/reverseBuffer";
import type { Recording } from "@/audio/recording";

export type AudioRecorderProps = {
  maxDurationMs: number;
  onRecorded: (recording: Recording) => void;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  audioContextFactory?: () => AudioContext;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

type Status = "idle" | "recording" | "decoding" | "error";

const VIZ_BARS = 64;
const VIZ_FFT_SIZE = 1024;
const VIZ_GAIN = 2.5;

export function AudioRecorder({
  maxDurationMs,
  onRecorded,
  recorderFactory = createRecorder,
  audioContextFactory = () => new AudioContext(),
  decode = decodeRecording,
  reverse = reverseBuffer,
}: AudioRecorderProps) {
  const recorderRef = useRef<Recorder | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const playheadRef = useRef<HTMLSpanElement | null>(null);

  const audioContextFactoryRef = useRef(audioContextFactory);
  audioContextFactoryRef.current = audioContextFactory;

  useEffect(() => {
    if (status !== "recording") return;
    const rec = recorderRef.current;
    if (rec === null) return;
    const stream = rec.getStream();
    if (stream === null) return;

    let ctx: AudioContext;
    try {
      ctx = audioContextFactoryRef.current();
    } catch {
      return;
    }
    if (typeof ctx.createMediaStreamSource !== "function") return;

    let source: MediaStreamAudioSourceNode;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch {
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = VIZ_FFT_SIZE;
    source.connect(analyser);

    // Some engines (notably Safari) only schedule an AnalyserNode if the graph
    // terminates at destination. Route through a muted GainNode so the audio
    // path is "live" without the user hearing themselves.
    let muteSink: GainNode | null = null;
    if (typeof ctx.createGain === "function") {
      muteSink = ctx.createGain();
      muteSink.gain.value = 0;
      analyser.connect(muteSink);
      muteSink.connect(ctx.destination);
    }

    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      void ctx.resume();
    }

    // Each bar represents one fixed time bucket of the max recording window.
    // We accumulate the peak instantaneous RMS observed inside the current
    // bucket so the bar height "freezes" as soon as the playhead moves past it
    // — the resulting waveform mirrors what AudioPlayer will draw afterwards.
    const bucketDurationMs = maxDurationMs / VIZ_BARS;
    const bucketRms = new Float32Array(VIZ_BARS);
    const bars = barRefs.current;
    const startMs = performance.now();
    const data = new Uint8Array(analyser.fftSize);
    let rafId: number | null = null;

    const loop = (): void => {
      analyser.getByteTimeDomainData(data);

      let sumSq = 0;
      for (let j = 0; j < data.length; j++) {
        const v = ((data[j] ?? 128) - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / data.length);

      const elapsed = performance.now() - startMs;
      const elapsedFrac = Math.min(1, elapsed / maxDurationMs);
      const currentBucket = Math.min(VIZ_BARS - 1, Math.floor(elapsed / bucketDurationMs));

      const prev = bucketRms[currentBucket] ?? 0;
      if (rms > prev) bucketRms[currentBucket] = rms;

      const activeHeight = Math.min(1, (bucketRms[currentBucket] ?? 0) * VIZ_GAIN);
      const activeEl = bars[currentBucket];
      if (activeEl !== null && activeEl !== undefined) {
        activeEl.style.height = `${Math.max(8, activeHeight * 100)}%`;
        if (!activeEl.classList.contains("recorder-waveform-bar-active")) {
          activeEl.classList.add("recorder-waveform-bar-active");
        }
      }

      if (playheadRef.current !== null) {
        playheadRef.current.style.left = `${elapsedFrac * 100}%`;
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      try {
        source.disconnect();
      } catch {
        // node already disconnected
      }
      try {
        analyser.disconnect();
      } catch {
        // node already disconnected
      }
      if (muteSink !== null) {
        try {
          muteSink.disconnect();
        } catch {
          // node already disconnected
        }
      }
      for (const el of barRefs.current) {
        if (el !== null && el !== undefined) {
          el.style.height = "8%";
          el.classList.remove("recorder-waveform-bar-active");
        }
      }
      if (playheadRef.current !== null) {
        playheadRef.current.style.left = "0%";
      }
    };
  }, [status, maxDurationMs]);

  async function handleStart() {
    setError(null);
    // Touch the AudioContext synchronously in the user gesture so it can
    // resume() — if we wait until the post-render effect, Safari refuses to
    // unlock and the analyser stays at digital silence (flat bars).
    try {
      const ctx = audioContextFactoryRef.current();
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        void ctx.resume();
      }
    } catch {
      // factory may throw in tests; ignore — recording itself doesn't depend on it
    }

    const rec = recorderFactory({ maxDurationMs });
    recorderRef.current = rec;
    try {
      await rec.start();
      setStatus("recording");
    } catch (err) {
      recorderRef.current = null;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleStop() {
    const rec = recorderRef.current;
    if (rec === null) return;
    setStatus("decoding");
    try {
      const blob = await rec.stop();
      const ctx = audioContextFactory();
      const forward = await decode(blob, ctx);
      const reversed = reverse(forward, ctx);
      const durationMs = (forward.length / forward.sampleRate) * 1000;
      onRecorded({ forward, reverse: reversed, durationMs });
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      recorderRef.current = null;
    }
  }

  return (
    <div className="recorder-stack">
      {(status === "idle" || status === "recording") && (
        <div className="recorder-waveform" aria-hidden="true" data-testid="recorder-waveform">
          {Array.from({ length: VIZ_BARS }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className="recorder-waveform-bar"
              style={{ height: "8%" }}
            />
          ))}
          {status === "recording" && (
            <span ref={playheadRef} className="recorder-waveform-playhead" style={{ left: "0%" }} />
          )}
        </div>
      )}
      {status === "idle" && (
        <button type="button" onClick={handleStart}>
          Enregistrer
        </button>
      )}
      {status === "recording" && (
        <>
          <div className="recorder-status">
            <span className="recording-pulse" aria-hidden="true" />
            <span>Enregistrement en cours…</span>
          </div>
          <button type="button" className="btn-danger" onClick={handleStop}>
            Arrêter
          </button>
        </>
      )}
      {status === "decoding" && (
        <p className="reveal-notes" aria-live="polite">
          <em>Décodage…</em>
        </p>
      )}
      {status === "error" && (
        <>
          <p role="alert">Erreur : {error}</p>
          <button type="button" className="btn-secondary" onClick={() => setStatus("idle")}>
            Réessayer
          </button>
        </>
      )}
    </div>
  );
}
