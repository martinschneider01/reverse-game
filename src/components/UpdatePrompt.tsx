import { useState } from "react";
import { usePwaStore } from "@/store/pwaStore";

export function UpdatePrompt() {
  const needsRefresh = usePwaStore((s) => s.needsRefresh);
  const acceptUpdate = usePwaStore((s) => s.acceptUpdate);
  const [reloading, setReloading] = useState(false);

  if (!needsRefresh) return null;

  async function handleReload(): Promise<void> {
    setReloading(true);
    await acceptUpdate();
  }

  return (
    <div role="status" aria-live="polite" className="update-prompt">
      <span className="update-prompt-text">Nouvelle version disponible</span>
      <button
        type="button"
        className="update-prompt-btn"
        onClick={() => {
          void handleReload();
        }}
        disabled={reloading}
      >
        {reloading ? "Rechargement…" : "Recharger"}
      </button>
    </div>
  );
}
