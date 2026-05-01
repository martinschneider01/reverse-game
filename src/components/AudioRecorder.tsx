import { useRef, useState } from "react";
import { createRecorder, type Recorder, type RecorderOptions } from "@/audio/wrappers/recorder";
import { decodeRecording } from "@/audio/decodeRecording";

export type AudioRecorderProps = {
  maxDurationMs: number;
  onRecorded: (buffer: AudioBuffer) => void;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  audioContextFactory?: () => AudioContext;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
};

type Status = "idle" | "recording" | "decoding" | "error";

export function AudioRecorder({
  maxDurationMs,
  onRecorded,
  recorderFactory = createRecorder,
  audioContextFactory = () => new AudioContext(),
  decode = decodeRecording,
}: AudioRecorderProps) {
  const recorderRef = useRef<Recorder | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
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
      const buffer = await decode(blob, ctx);
      onRecorded(buffer);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      recorderRef.current = null;
    }
  }

  return (
    <div>
      {status === "idle" && (
        <button type="button" onClick={handleStart}>
          Enregistrer
        </button>
      )}
      {status === "recording" && (
        <button type="button" onClick={handleStop}>
          Arrêter
        </button>
      )}
      {status === "decoding" && <p>Décodage…</p>}
      {status === "error" && (
        <div>
          <p role="alert">Erreur : {error}</p>
          <button type="button" onClick={() => setStatus("idle")}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
