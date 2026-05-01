import { AudioRecorder } from "@/components/AudioRecorder";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import { useGameStore } from "@/store/gameStore";

const MAX_DURATION_MS = 15000;

export type RecordingAPhaseProps = {
  audioContextFactory: () => AudioContext;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

export function RecordingAPhase({
  audioContextFactory,
  recorderFactory,
  decode,
  reverse,
}: RecordingAPhaseProps) {
  const finishRecordingA = useGameStore((s) => s.finishRecordingA);

  return (
    <section>
      <h2>Enregistrement</h2>
      <p>Prononce une phrase courte (max 15 s).</p>
      <AudioRecorder
        maxDurationMs={MAX_DURATION_MS}
        onRecorded={finishRecordingA}
        audioContextFactory={audioContextFactory}
        recorderFactory={recorderFactory}
        decode={decode}
        reverse={reverse}
      />
    </section>
  );
}
