import { AudioPlayer } from "@/components/AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

export type GuessingP4PhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function GuessingP4Phase({ audioContextFactory, playerFactory }: GuessingP4PhaseProps) {
  const ouzbekRecordingP3 = useGameStore((s) => s.ouzbekRecordingP3);
  const revealOuzbekChain = useGameStore((s) => s.revealOuzbekChain);

  if (ouzbekRecordingP3 === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à écouter.</p>
      </section>
    );
  }

  const ctx = audioContextFactory();

  return (
    <section>
      <p className="kicker">Joueur 4</p>
      <h2>Écoute et donne ta réponse à voix haute</h2>
      <p>
        Écoute la version inversée de l'enregistrement de J3, puis annonce à J1 ce que tu as
        compris. Quand J1 confirme la chaîne, révélez le résultat.
      </p>

      <div className="card">
        <h3>Enregistrement de J3 (à l'envers)</h3>
        <AudioPlayer
          recording={ouzbekRecordingP3}
          audioContext={ctx}
          lockDirection="reverse"
          playerFactory={playerFactory}
        />
      </div>

      <button type="button" onClick={revealOuzbekChain}>
        Tout révéler
      </button>
    </section>
  );
}
