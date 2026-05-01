import { useGameStore } from "@/store/gameStore";

export function DonePhase() {
  const backToMenu = useGameStore((s) => s.backToMenu);
  return (
    <section>
      <h2>Enregistrement capturé</h2>
      <p>
        L'enregistrement de A est prêt. La phase suivante du jeu sera implémentée dans une slice
        ultérieure.
      </p>
      <button type="button" onClick={backToMenu}>
        Retour au menu
      </button>
    </section>
  );
}
