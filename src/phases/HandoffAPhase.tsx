import { useGameStore } from "@/store/gameStore";

export function HandoffAPhase() {
  const confirmHandoffA = useGameStore((s) => s.confirmHandoffA);
  return (
    <section className="center-screen">
      <p className="kicker">Joueur A</p>
      <h2>Éloigne-toi des autres joueurs</h2>
      <p>
        Pour qu'ils n'entendent pas ta phrase. Quand tu es prêt, appuie sur Continuer pour démarrer
        l'enregistrement.
      </p>
      <button type="button" onClick={confirmHandoffA}>
        Continuer
      </button>
    </section>
  );
}
