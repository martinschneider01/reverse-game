import { AudioPlayer } from "@/components/AudioPlayer";
import { AudioRecorder } from "@/components/AudioRecorder";
import { NotesEditor } from "@/components/NotesEditor";
import type { Recorder, RecorderOptions } from "@/audio/wrappers/recorder";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

const MAX_DURATION_MS = 15000;

export type GuessingPhaseProps = {
  audioContextFactory: () => AudioContext;
  recorderFactory?: (options: RecorderOptions) => Recorder;
  playerFactory?: (ctx: AudioContext) => Player;
  decode?: (blob: Blob, ctx: AudioContext) => Promise<AudioBuffer>;
  reverse?: (buffer: AudioBuffer, ctx: AudioContext) => AudioBuffer;
};

export function GuessingPhase({
  audioContextFactory,
  recorderFactory,
  playerFactory,
  decode,
  reverse,
}: GuessingPhaseProps) {
  const originalRecording = useGameStore((s) => s.originalRecording);
  const guessRecording = useGameStore((s) => s.guessRecording);
  const notes = useGameStore((s) => s.notes);
  const listenCount = useGameStore((s) => s.listenCount);
  const challengeRules = useGameStore((s) => s.challengeRules);
  const setNotes = useGameStore((s) => s.setNotes);
  const setGuessRecording = useGameStore((s) => s.setGuessRecording);
  const incrementListenCount = useGameStore((s) => s.incrementListenCount);
  const endGuessing = useGameStore((s) => s.endGuessing);

  const notesEnabled = challengeRules?.notesEnabled !== false;
  const listenLimit = challengeRules?.listenLimit ?? null;
  const limitReached = listenLimit !== null && listenCount >= listenLimit;
  const counterText =
    listenLimit !== null ? `Écoutes : ${listenCount} / ${listenLimit}` : `Écoutes : ${listenCount}`;

  if (originalRecording === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à deviner.</p>
      </section>
    );
  }

  const ctx = audioContextFactory();

  return (
    <section>
      <p className="kicker">Joueur 2</p>
      <h2>Devine la phrase</h2>

      <div className="card">
        <h3>Enregistrement original (à l'envers)</h3>
        <AudioPlayer
          recording={originalRecording}
          audioContext={ctx}
          lockDirection="reverse"
          disabled={limitReached}
          playerFactory={playerFactory}
          onPlay={incrementListenCount}
        />
        <p aria-label="Compteur d'écoutes" className="counter-chip">
          {counterText}
        </p>
      </div>

      {notesEnabled && (
        <div className="card">
          <NotesEditor value={notes} onChange={setNotes} />
        </div>
      )}

      <div className="card">
        <h3>Ta voix</h3>
        {guessRecording === null ? (
          <AudioRecorder
            maxDurationMs={MAX_DURATION_MS}
            onRecorded={setGuessRecording}
            audioContextFactory={audioContextFactory}
            recorderFactory={recorderFactory}
            decode={decode}
            reverse={reverse}
          />
        ) : (
          <AudioPlayer
            recording={guessRecording}
            audioContext={ctx}
            showRateControl={false}
            playerFactory={playerFactory}
            onClose={() => setGuessRecording(null)}
          />
        )}
      </div>

      <button type="button" className="btn-danger" onClick={endGuessing}>
        Fin
      </button>
    </section>
  );
}
