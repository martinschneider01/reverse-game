import { AudioPlayer } from "@/components/AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

export type RevealPhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function RevealPhase({ audioContextFactory, playerFactory }: RevealPhaseProps) {
  const originalRecording = useGameStore((s) => s.originalRecording);
  const guessRecording = useGameStore((s) => s.guessRecording);
  const notes = useGameStore((s) => s.notes);
  const newRound = useGameStore((s) => s.newRound);
  const backToMenu = useGameStore((s) => s.backToMenu);

  if (originalRecording === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à révéler.</p>
        <button type="button" onClick={backToMenu}>
          Retour au menu
        </button>
      </section>
    );
  }

  const ctx = audioContextFactory();

  return (
    <section>
      <h2>Révélation</h2>

      <div>
        <h3>Enregistrement original</h3>
        <AudioPlayer
          recording={originalRecording}
          audioContext={ctx}
          playerFactory={playerFactory}
        />
      </div>

      {guessRecording !== null && (
        <div>
          <h3>Voix du joueur B</h3>
          <AudioPlayer
            recording={guessRecording}
            audioContext={ctx}
            initialDirection="reverse"
            playerFactory={playerFactory}
          />
        </div>
      )}

      <div>
        <h3>Notes</h3>
        {notes === "" ? (
          <p>
            <em>Aucune note prise.</em>
          </p>
        ) : (
          <p aria-label="Notes">{notes}</p>
        )}
      </div>

      <button type="button" onClick={newRound}>
        Nouvelle partie
      </button>
      <button type="button" onClick={backToMenu}>
        Retour au menu
      </button>
    </section>
  );
}
