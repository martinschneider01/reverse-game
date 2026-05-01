import { useGameStore } from "@/store/gameStore";

export function HandoffAPhase() {
  const confirmHandoffA = useGameStore((s) => s.confirmHandoffA);
  return (
    <section>
      <h2>Joueur A</h2>
      <p>Éloigne-toi des autres joueurs pour qu'ils n'entendent pas ta phrase.</p>
      <p>Quand tu es prêt, appuie sur Continuer pour démarrer l'enregistrement.</p>
      <button type="button" onClick={confirmHandoffA}>
        Continuer
      </button>
    </section>
  );
}
