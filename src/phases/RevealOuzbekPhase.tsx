import { AudioPlayer } from "@/components/AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

export type RevealOuzbekPhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function RevealOuzbekPhase({ audioContextFactory, playerFactory }: RevealOuzbekPhaseProps) {
  const ouzbekRecordingP1 = useGameStore((s) => s.ouzbekRecordingP1);
  const ouzbekThemeP1 = useGameStore((s) => s.ouzbekThemeP1);
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
      <p aria-label="Chaîne du round">J1 → J2 → J3 → J4</p>

      <div className="card">
        <p className="kicker">Joueur 1</p>
        <h3>Enregistrement original</h3>
        <p>Lisible à l'endroit et à l'envers.</p>
        {ouzbekThemeP1 !== "" && <p aria-label="Thème de J1">Thème : {ouzbekThemeP1}</p>}
        <AudioPlayer
          recording={ouzbekRecordingP1}
          audioContext={ctx}
          playerFactory={playerFactory}
          downloadName="reverso-J1"
        />
      </div>

      <div className="card">
        <p className="kicker">Joueur 2</p>
        <h3>Note transcrite à l'écoute (à l'envers de J1)</h3>
        {ouzbekNoteP2 === "" ? (
          <p className="reveal-notes">
            <em>Aucune note prise.</em>
          </p>
        ) : (
          <p aria-label="Note de J2">{ouzbekNoteP2}</p>
        )}
      </div>

      <div className="card">
        <p className="kicker">Joueur 3</p>
        <h3>Enregistrement à partir de la note</h3>
        <p>Lisible à l'endroit et à l'envers.</p>
        <AudioPlayer
          recording={ouzbekRecordingP3}
          audioContext={ctx}
          playerFactory={playerFactory}
          downloadName="reverso-J3"
        />
      </div>

      <div className="card">
        <p className="kicker">Joueur 4</p>
        <h3>Réponse à voix haute</h3>
        <p className="reveal-notes" aria-label="Réponse de J4">
          <em>J4 a annoncé sa réponse oralement à J1 — non enregistrée.</em>
        </p>
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
