import { useGameStore } from "@/store/gameStore";

export function HandoffBPhase() {
  const confirmHandoffB = useGameStore((s) => s.confirmHandoffB);
  return (
    <section>
      <h2>Joueur B</h2>
      <p>Passe le téléphone à B. À toi de deviner la phrase enregistrée par A.</p>
      <button type="button" onClick={confirmHandoffB}>
        Continuer
      </button>
    </section>
  );
}
