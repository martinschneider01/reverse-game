import { AudioPlayer } from "@/components/AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

export type RevealOuzbekPhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function RevealOuzbekPhase({ audioContextFactory, playerFactory }: RevealOuzbekPhaseProps) {
  const ouzbekRecordingP1 = useGameStore((s) => s.ouzbekRecordingP1);
  const ouzbekNoteP2 = useGameStore((s) => s.ouzbekNoteP2);
  const ouzbekRecordingP3 = useGameStore((s) => s.ouzbekRecordingP3);
  const newOuzbekRound = useGameStore((s) => s.newOuzbekRound);
  const backToMenu = useGameStore((s) => s.backToMenu);

  if (ouzbekRecordingP1 === null || ouzbekRecordingP3 === null) {
    return (
      <section>
        <p role="alert">Chaîne incomplète à révéler.</p>
        <button type="button" className="btn-secondary" onClick={backToMenu}>
          Retour au menu
        </button>
      </section>
    );
  }

  const ctx = audioContextFactory();

  return (
    <section>
      <p className="kicker">Round terminé</p>
      <h2>Révélation</h2>

      <div className="card">
        <h3>Enregistrement de J1</h3>
        <AudioPlayer
          recording={ouzbekRecordingP1}
          audioContext={ctx}
          playerFactory={playerFactory}
        />
      </div>

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
        <h3>Enregistrement de J3</h3>
        <AudioPlayer
          recording={ouzbekRecordingP3}
          audioContext={ctx}
          playerFactory={playerFactory}
        />
      </div>

      <button type="button" onClick={newOuzbekRound}>
        Nouvelle partie
      </button>
      <button type="button" className="btn-secondary" onClick={backToMenu}>
        Retour au menu
      </button>
    </section>
  );
}
