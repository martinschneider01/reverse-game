import { useGameStore } from "@/store/gameStore";

export function HandoffBPhase() {
  const confirmHandoffB = useGameStore((s) => s.confirmHandoffB);
  return (
    <section className="center-screen">
      <p className="kicker">Joueur B</p>
      <h2>Passe le téléphone à B</h2>
      <p>À toi de deviner la phrase enregistrée par A.</p>
      <button type="button" onClick={confirmHandoffB}>
        Continuer
      </button>
    </section>
  );
}
