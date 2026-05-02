import { AudioPlayer } from "@/components/AudioPlayer";
import { NotesEditor } from "@/components/NotesEditor";
import type { Player } from "@/audio/wrappers/player";
import { useGameStore } from "@/store/gameStore";

export type GuessingP2PhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function GuessingP2Phase({ audioContextFactory, playerFactory }: GuessingP2PhaseProps) {
  const ouzbekRecordingP1 = useGameStore((s) => s.ouzbekRecordingP1);
  const ouzbekNoteP2 = useGameStore((s) => s.ouzbekNoteP2);
  const setOuzbekNoteP2 = useGameStore((s) => s.setOuzbekNoteP2);
  const finishGuessingP2 = useGameStore((s) => s.finishGuessingP2);

  if (ouzbekRecordingP1 === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à écouter.</p>
      </section>
    );
  }

  const ctx = audioContextFactory();

  return (
    <section>
      <p className="kicker">Joueur 2</p>
      <h2>Écoute et transcris</h2>
      <p>
        Écoute la version inversée de l'enregistrement de J1, puis transcris ce que tu entends. Ta
        note sera lue par J3.
      </p>

      <div className="card">
        <h3>Enregistrement de J1 (à l'envers)</h3>
        <AudioPlayer
          recording={ouzbekRecordingP1}
          audioContext={ctx}
          lockDirection="reverse"
          playerFactory={playerFactory}
        />
      </div>

      <div className="card">
        <NotesEditor value={ouzbekNoteP2} onChange={setOuzbekNoteP2} />
      </div>

      <button type="button" onClick={finishGuessingP2}>
        Passer au Joueur 3
      </button>
    </section>
  );
}
