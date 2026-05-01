import { useGameStore } from "@/store/gameStore";

export function RevealPhase() {
  const backToMenu = useGameStore((s) => s.backToMenu);
  return (
    <section>
      <h2>Révélation</h2>
      <p>L'écran de révélation complet sera implémenté dans une slice ultérieure.</p>
      <button type="button" onClick={backToMenu}>
        Retour au menu
      </button>
    </section>
  );
}
