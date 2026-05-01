import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";
import type { Recording } from "@/audio/recording";
import { useGameStore } from "@/store/gameStore";

const MAX_DURATION_MS = 15000;

export type RecordingAPhaseProps = {
  audioContextFactory: () => AudioContext;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  playerFactory?: (ctx: AudioContext) => Player;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

export function RecordingAPhase({
  audioContextFactory,
  recorderFactory,
  playerFactory,
  decode,
  reverse,
}: RecordingAPhaseProps) {
  const finishRecordingA = useGameStore((s) => s.finishRecordingA);
  const [preview, setPreview] = useState<Recording | null>(null);

  if (preview === null) {
    return (
      <section>
        <p className="kicker">Joueur A</p>
        <h2>Enregistre ton vocal sans que personne ne t'écoute</h2>
        <p>Prononce une phrase courte (15 s max).</p>
        <div className="card">
          <AudioRecorder
            maxDurationMs={MAX_DURATION_MS}
            onRecorded={setPreview}
            audioContextFactory={audioContextFactory}
            recorderFactory={recorderFactory}
            decode={decode}
            reverse={reverse}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Joueur A</p>
      <h2>Pré-écoute</h2>
      <p>Vérifie ta prise avant de passer le téléphone à B.</p>
      <div className="card">
        <AudioPlayer
          recording={preview}
          audioContext={audioContextFactory()}
          playerFactory={playerFactory}
          onClose={() => setPreview(null)}
        />
      </div>
      <button type="button" onClick={() => finishRecordingA(preview)}>
        Passer à B
      </button>
    </section>
  );
}
