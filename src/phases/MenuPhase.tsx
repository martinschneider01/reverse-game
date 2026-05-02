import { useGameStore } from "@/store/gameStore";

export function MenuPhase() {
  const startGame = useGameStore((s) => s.startGame);
  const startChallenge = useGameStore((s) => s.startChallenge);
  const startOuzbek = useGameStore((s) => s.startOuzbek);
  return (
    <section className="menu-screen">
      <div className="brand">
        <h1 className="brand-mark" aria-label="Reverso">
          <span className="brand-mark-main">Reverso</span>
          <span aria-hidden="true" className="brand-mark-echo">
            osreveR
          </span>
        </h1>
        <p className="brand-tagline">Enregistre. Écoute à l'envers. Devine.</p>
      </div>

      <div className="menu-actions">
        <button type="button" className="cta-primary" onClick={startGame}>
          Nouvelle partie
        </button>
        <button type="button" className="cta-secondary" onClick={startChallenge}>
          Mode Challenge
        </button>
        <button type="button" className="cta-secondary" onClick={startOuzbek}>
          Mode Ouzbek
        </button>
      </div>

      <details className="menu-howto">
        <summary>Comment ça marche&nbsp;?</summary>
        <ol>
          <li>
            <strong>Joueur 1</strong> enregistre une phrase de son choix.
          </li>
          <li>
            L'app <strong>inverse l'audio</strong> et passe le téléphone à <strong>Joueur 2</strong>
            .
          </li>
          <li>
            Joueur 2 écoute la version inversée et tente de <strong>retrouver la phrase</strong>.
          </li>
        </ol>
      </details>

      <p className="menu-footer">Hors-ligne · sans compte · entre amis</p>
    </section>
  );
}
