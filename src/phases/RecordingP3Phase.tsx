import { useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";
import type { Recording } from "@/audio/recording";
import { useGameStore } from "@/store/gameStore";

const MAX_DURATION_MS = 15000;

export type RecordingP3PhaseProps = {
  audioContextFactory: () => AudioContext;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  playerFactory?: (ctx: AudioContext) => Player;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

export function RecordingP3Phase({
  audioContextFactory,
  recorderFactory,
  playerFactory,
  decode,
  reverse,
}: RecordingP3PhaseProps) {
  const ouzbekNoteP2 = useGameStore((s) => s.ouzbekNoteP2);
  const finishRecordingP3 = useGameStore((s) => s.finishRecordingP3);
  const [preview, setPreview] = useState<Recording | null>(null);

  if (preview === null) {
    return (
      <section>
        <p className="kicker">Joueur 3</p>
        <h2>Lis la note et enregistre</h2>
        <p>Lis la note de J2 à voix haute. J4 écoutera ton enregistrement à l'envers.</p>

        <div className="card">
          <h3>Note de J2</h3>
          {ouzbekNoteP2 === "" ? (
            <p className="reveal-notes">
              <em>Aucune note prise.</em>
            </p>
          ) : (
            <p aria-label="Note de J2">{ouzbekNoteP2}</p>
          )}
        </div>

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
      <p className="kicker">Joueur 3</p>
      <h2>Pré-écoute</h2>
      <p>
        Vérifie ta prise. Tu peux uniquement la réécouter à l'endroit — c'est J4 qui l'écoutera à
        l'envers.
      </p>
      <div className="card">
        <AudioPlayer
          recording={preview}
          audioContext={audioContextFactory()}
          lockDirection="forward"
          playerFactory={playerFactory}
          onClose={() => setPreview(null)}
        />
      </div>
      <button type="button" onClick={() => finishRecordingP3(preview)}>
        Passer au Joueur 4
      </button>
    </section>
  );
}
