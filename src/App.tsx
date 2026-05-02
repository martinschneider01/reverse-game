import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { installIosAudioUnlock } from "@/audio/iosAudioUnlock";
import { installAudioContextResume } from "@/audio/audioContextResume";
import { loadPersistedState, type PersistedRecording } from "@/store/persistence";
import { startGameStorePersistence } from "@/store/persistGameStore";
import { reverseBuffer } from "@/audio/reverseBuffer";
import type { Recording } from "@/audio/recording";
import { MenuPhase } from "@/phases/MenuPhase";
import { PermissionPhase } from "@/phases/PermissionPhase";
import { PermissionDeniedPhase } from "@/phases/PermissionDeniedPhase";
import { RecordingAPhase } from "@/phases/RecordingAPhase";
import { GuessingPhase } from "@/phases/GuessingPhase";
import { RevealPhase } from "@/phases/RevealPhase";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const HAS_IDB = typeof indexedDB !== "undefined";

async function rehydrateRecording(p: PersistedRecording, ctx: AudioContext): Promise<Recording> {
  // decodeAudioData detaches its input ArrayBuffer; clone via .arrayBuffer()
  // each call so a future re-decode (unlikely but cheap insurance) still works.
  const data = await p.blob.arrayBuffer();
  const forward = await ctx.decodeAudioData(data);
  const reversed = reverseBuffer(forward, ctx);
  return { forward, reverse: reversed, durationMs: p.durationMs, blob: p.blob };
}

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const phase = useGameStore((s) => s.phase);
  const confirmEnd = useGameStore((s) => s.confirmEnd);
  const cancelEnd = useGameStore((s) => s.cancelEnd);
  const [hydrated, setHydrated] = useState(!HAS_IDB);

  useEffect(() => installIosAudioUnlock(), []);
  useEffect(() => installAudioContextResume(() => audioContextRef.current), []);

  function getAudioContext(): AudioContext {
    if (audioContextRef.current === null) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  useEffect(() => {
    if (!HAS_IDB) return;
    let cancelled = false;
    void (async () => {
      try {
        const persisted = await loadPersistedState();
        if (cancelled || persisted === null) return;
        if (persisted.originalRecording === null) return;
        const ctx = getAudioContext();
        const original = await rehydrateRecording(persisted.originalRecording, ctx);
        const guess =
          persisted.guessRecording !== null
            ? await rehydrateRecording(persisted.guessRecording, ctx)
            : null;
        if (cancelled) return;
        useGameStore.setState({
          phase: persisted.phase,
          originalRecording: original,
          guessRecording: guess,
          notes: persisted.notes,
          listenCount: persisted.listenCount,
        });
      } catch {
        // Hydration failed (corrupt blob, decode error). Fall back to menu.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    return startGameStorePersistence();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <main aria-busy="true">
        <p className="reveal-notes">
          <em>Chargement…</em>
        </p>
      </main>
    );
  }

  return (
    <main>
      {phase === "menu" && <MenuPhase />}
      {phase === "permission" && <PermissionPhase />}
      {phase === "permissionDenied" && <PermissionDeniedPhase />}
      {phase === "recordingA" && <RecordingAPhase audioContextFactory={getAudioContext} />}
      {(phase === "guessing" || phase === "confirmEnd") && (
        <GuessingPhase audioContextFactory={getAudioContext} />
      )}
      {phase === "reveal" && <RevealPhase audioContextFactory={getAudioContext} />}
      {phase === "confirmEnd" && (
        <ConfirmDialog
          title="Êtes-vous sûr ?"
          message="Mettre fin au round révélera l'enregistrement original. Cette action est définitive."
          confirmVariant="danger"
          onConfirm={confirmEnd}
          onCancel={cancelEnd}
        />
      )}
    </main>
  );
}
