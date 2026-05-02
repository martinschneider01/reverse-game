import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";
import type { Recording } from "@/audio/recording";
import { useGameStore } from "@/store/gameStore";

const MAX_DURATION_MS = 15000;

export type RecordingP1PhaseProps = {
  audioContextFactory: () => AudioContext;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  playerFactory?: (ctx: AudioContext) => Player;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

export function RecordingP1Phase({
  audioContextFactory,
  recorderFactory,
  playerFactory,
  decode,
  reverse,
}: RecordingP1PhaseProps) {
  const finishRecordingP1 = useGameStore((s) => s.finishRecordingP1);
  const [preview, setPreview] = useState<Recording | null>(null);

  if (preview === null) {
    return (
      <section>
        <p className="kicker">Joueur 1</p>
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
      <p className="kicker">Joueur 1</p>
      <h2>Pré-écoute</h2>
      <p>Vérifie ta prise avant de passer le téléphone au Joueur 2.</p>
      <div className="card">
        <AudioPlayer
          recording={preview}
          audioContext={audioContextFactory()}
          playerFactory={playerFactory}
          onClose={() => setPreview(null)}
        />
      </div>
      <button type="button" onClick={() => finishRecordingP1(preview)}>
        Passer au Joueur 2
      </button>
    </section>
  );
}
