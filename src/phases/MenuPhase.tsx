import { useGameStore } from "@/store/gameStore";

export function MenuPhase() {
  const startGame = useGameStore((s) => s.startGame);
  return (
    <section>
      <h1>Reverso</h1>
      <p>Un jeu vocal où l'on devine la phrase d'un autre joueur à l'envers.</p>
      <button type="button" onClick={startGame}>
        Démarrer une partie
      </button>
    </section>
  );
}
