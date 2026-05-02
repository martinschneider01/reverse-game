import { useRef } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import type { Phase } from "@/store/gameStore";
import { useGameStore } from "@/store/gameStore";
import { useGuessingTimer, formatRemaining } from "./useGuessingTimer";

const TIMER_ACTIVE_PHASES: ReadonlySet<Phase> = new Set<Phase>(["guessingP4"]);

export type GuessingP4PhaseProps = {
  audioContextFactory: () => AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function GuessingP4Phase({ audioContextFactory, playerFactory }: GuessingP4PhaseProps) {
  const ouzbekRecordingP3 = useGameStore((s) => s.ouzbekRecordingP3);
  const ouzbekThemeP1 = useGameStore((s) => s.ouzbekThemeP1);
  const listenCount = useGameStore((s) => s.listenCount);
  const challengeRules = useGameStore((s) => s.challengeRules);
  const incrementListenCount = useGameStore((s) => s.incrementListenCount);
  const revealOuzbekChain = useGameStore((s) => s.revealOuzbekChain);

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

  if (ouzbekRecordingP3 === null) {
    return (
      <section>
        <p role="alert">Aucun enregistrement à écouter.</p>
      </section>
    );
  }

  return (
    <section>
      <p className="kicker">Joueur 4</p>
      <h2>Écoute et donne ta réponse à voix haute</h2>
      <p>
        Écoute la version inversée de l'enregistrement de J3, puis annonce à J1 ce que tu as
        compris. Quand J1 confirme la chaîne, révélez le résultat.
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
        <h3>Enregistrement de J3 (à l'envers)</h3>
        {ouzbekThemeP1 !== "" && <p aria-label="Thème de J1">Thème : {ouzbekThemeP1}</p>}
        <AudioPlayer
          recording={ouzbekRecordingP3}
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

      <button type="button" onClick={revealOuzbekChain}>
        Tout révéler
      </button>
    </section>
  );
}
