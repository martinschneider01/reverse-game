import { useRef } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { NotesEditor } from "@/components/NotesEditor";
import type { Player } from "@/audio/wrappers/player";
import type { Phase } from "@/store/gameStore";
import { useGameStore } from "@/store/gameStore";
import { useGuessingTimer, formatRemaining } from "./useGuessingTimer";

const TIMER_ACTIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>(["guessingP2"]);

export type GuessingP2PhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function GuessingP2Phase({ audioContextFactory, playerFactory }: GuessingP2PhaseProps) {
  const ouzbekRecordingP1 = useGameStore((s) => s.ouzbekRecordingP1);
  const ouzbekNoteP2 = useGameStore((s) => s.ouzbekNoteP2);
  const listenCount = useGameStore((s) => s.listenCount);
  const challengeRules = useGameStore((s) => s.challengeRules);
  const setOuzbekNoteP2 = useGameStore((s) => s.setOuzbekNoteP2);
  const incrementListenCount = useGameStore((s) => s.incrementListenCount);
  const finishGuessingP2 = useGameStore((s) => s.finishGuessingP2);

  const listenLimit = challengeRules?.listenLimit ?? null;
  const limitReached = listenLimit !== null && listenCount >= listenLimit;
  const counterText =
    listenLimit !== null ? `Écoutes : ${listenCount} / ${listenLimit}` : `Écoutes : ${listenCount}`;

  const ctxRef = useRef<AudioContext | null>(null);
  if (ctxRef.current === null) {
    ctxRef.current = audioContextFactory();
  }
  const ctx = ctxRef.current;

  const { remainingMs, isWarning } = useGuessingTimer({
    activePhases: TIMER_ACTIVE_PHASES,
    audioContext: ctx,
  });

  if (ouzbekRecordingP1 === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à écouter.</p>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Joueur 2</p>
      <h2>Écoute et transcris</h2>
      <p>
        Écoute la version inversée de l'enregistrement de J1, puis transcris ce que tu entends. Ta
        note sera lue par J3.
      </p>

      {remainingMs !== null && (
        <p
          aria-label="Temps restant"
          aria-live="polite"
          className={`counter-chip timer-chip${isWarning ? " timer-chip-warning" : ""}`}
        >
          Temps : {formatRemaining(remainingMs)}
        </p>
      )}

      <div className="card">
        <h3>Enregistrement de J1 (à l'envers)</h3>
        <AudioPlayer
          recording={ouzbekRecordingP1}
          audioContext={ctx}
          lockDirection="reverse"
          disabled={limitReached}
          playerFactory={playerFactory}
          onPlay={incrementListenCount}
        />
        {challengeRules !== null && (
          <p aria-label="Compteur d'écoutes" className="counter-chip">
            {counterText}
          </p>
        )}
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
