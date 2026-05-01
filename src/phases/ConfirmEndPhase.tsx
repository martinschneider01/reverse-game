import { useGameStore } from "@/store/gameStore";

export function ConfirmEndPhase() {
  const confirmEnd = useGameStore((s) => s.confirmEnd);
  const cancelEnd = useGameStore((s) => s.cancelEnd);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-end-title"
      className="center-screen"
    >
      <h2 id="confirm-end-title">Êtes-vous sûr ?</h2>
      <p>Mettre fin au round révélera l'enregistrement original. Cette action est définitive.</p>
      <button type="button" className="btn-danger" onClick={confirmEnd}>
        Confirmer
      </button>
      <button type="button" className="btn-secondary" onClick={cancelEnd}>
        Annuler
      </button>
    </section>
  );
}
