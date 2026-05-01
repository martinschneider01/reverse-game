import { useGameStore } from "@/store/gameStore";

export function PermissionDeniedPhase() {
  const retryPermission = useGameStore((s) => s.retryPermission);
  const backToMenu = useGameStore((s) => s.backToMenu);

  return (
    <section>
      <h2>Accès au micro refusé</h2>
      <p role="alert">
        Sans accès au micro, on ne peut pas enregistrer ta voix. Autorise le micro pour cette page,
        puis réessaie.
      </p>
      <details>
        <summary>Comment autoriser le micro ?</summary>
        <ul>
          <li>
            <strong>iOS Safari</strong> : Réglages → Safari → Micro → Autoriser pour ce site.
          </li>
          <li>
            <strong>Android Chrome</strong> : touche le cadenas dans la barre d'adresse →
            Autorisations → active "Micro".
          </li>
        </ul>
      </details>
      <button type="button" onClick={retryPermission}>
        Réessayer
      </button>
      <button type="button" className="btn-secondary" onClick={backToMenu}>
        Retour au menu
      </button>
    </section>
  );
}
