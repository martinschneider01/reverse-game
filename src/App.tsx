import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { installIosAudioUnlock } from "@/audio/iosAudioUnlock";
import { installAudioContextResume } from "@/audio/audioContextResume";
import { loadPersistedState, type PersistedRecording } from "@/store/persistence";
import { startGameStorePersistence } from "@/store/persistGameStore";
import { reverseBuffer } from "@/audio/reverseBuffer";
import { computePeakGain } from "@/audio/peakGain";
import type { Recording } from "@/audio/recording";
import { MenuPhase } from "@/phases/MenuPhase";
import { ChallengeConfigPhase } from "@/phases/ChallengeConfigPhase";
import { OuzbekChallengeConfigPhase } from "@/phases/OuzbekChallengeConfigPhase";
import { PermissionPhase } from "@/phases/PermissionPhase";
import { PermissionDeniedPhase } from "@/phases/PermissionDeniedPhase";
import { RecordingAPhase } from "@/phases/RecordingAPhase";
import { GuessingPhase } from "@/phases/GuessingPhase";
import { RevealPhase } from "@/phases/RevealPhase";
import { RecordingP1Phase } from "@/phases/RecordingP1Phase";
import { HandoffPhase } from "@/phases/HandoffPhase";
import { GuessingP2Phase } from "@/phases/GuessingP2Phase";
import { RecordingP3Phase } from "@/phases/RecordingP3Phase";
import { GuessingP4Phase } from "@/phases/GuessingP4Phase";
import { RevealOuzbekPhase } from "@/phases/RevealOuzbekPhase";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import type { PersistedPhase } from "@/store/persistence";

const HAS_IDB = typeof indexedDB !== "undefined";

// Mode 1 / Challenge: timer expiry skips confirmEnd → reveal.
// Ouzbek Challenge: P2 → handoffP3 (chain continues with partial note);
// P4 → revealOuzbek (cf. PROJECT.md §3.13). Returns null when the persisted
// phase isn't timer-bearing.
function timerExpiryTarget(phase: PersistedPhase): PersistedPhase | null {
  if (phase === "guessing" || phase === "confirmEnd") return "reveal";
  if (phase === "guessingP2") return "handoffP3";
  if (phase === "guessingP4") return "revealOuzbek";
  return null;
}

async function rehydrateRecording(p: PersistedRecording, ctx: AudioContext): Promise<Recording> {
  // decodeAudioData detaches its input ArrayBuffer; clone via .arrayBuffer()
  // each call so a future re-decode (unlikely but cheap insurance) still works.
  const data = await p.blob.arrayBuffer();
  const forward = await ctx.decodeAudioData(data);
  const reversed = reverseBuffer(forward, ctx);
  const gain = computePeakGain(forward);
  return { forward, reverse: reversed, durationMs: p.durationMs, gain, blob: p.blob };
}

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const phase = useGameStore((s) => s.phase);
  const confirmEnd = useGameStore((s) => s.confirmEnd);
  const cancelEnd = useGameStore((s) => s.cancelEnd);
  const startGuessingP2 = useGameStore((s) => s.startGuessingP2);
  const startRecordingP3 = useGameStore((s) => s.startRecordingP3);
  const startGuessingP4 = useGameStore((s) => s.startGuessingP4);
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
        const ctx = getAudioContext();

        // Mode 1 / Challenge requires originalRecording; Ouzbek requires
        // ouzbekRecordingP1. If neither is present we have nothing to resume.
        if (persisted.mode === "ouzbek" && persisted.ouzbekRecordingP1 === null) return;
        if (persisted.mode !== "ouzbek" && persisted.originalRecording === null) return;

        const original =
          persisted.originalRecording !== null
            ? await rehydrateRecording(persisted.originalRecording, ctx)
            : null;
        const guess =
          persisted.guessRecording !== null
            ? await rehydrateRecording(persisted.guessRecording, ctx)
            : null;
        const ouzbekP1 =
          persisted.ouzbekRecordingP1 !== null
            ? await rehydrateRecording(persisted.ouzbekRecordingP1, ctx)
            : null;
        const ouzbekP3 =
          persisted.ouzbekRecordingP3 !== null
            ? await rehydrateRecording(persisted.ouzbekRecordingP3, ctx)
            : null;
        if (cancelled) return;
        // Timer expiry on hydration: if a Challenge timer ran out while the
        // PWA was unloaded, advance the chain (cf. §3.12 + §3.13).
        const timerMs = persisted.challengeRules?.timerMs ?? null;
        const startedAt = persisted.guessingStartedAt;
        const expiryTarget = timerExpiryTarget(persisted.phase);
        const expired =
          timerMs !== null &&
          startedAt !== null &&
          expiryTarget !== null &&
          Date.now() - startedAt >= timerMs;
        useGameStore.setState({
          phase: expired && expiryTarget !== null ? expiryTarget : persisted.phase,
          mode: persisted.mode,
          originalRecording: original,
          guessRecording: guess,
          notes: persisted.notes,
          listenCount: persisted.listenCount,
          challengeRules: persisted.challengeRules,
          guessingStartedAt: expired ? null : persisted.guessingStartedAt,
          ouzbekRecordingP1: ouzbekP1,
          ouzbekNoteP2: persisted.ouzbekNoteP2,
          ouzbekRecordingP3: ouzbekP3,
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
      {phase === "challengeConfig" && <ChallengeConfigPhase />}
      {phase === "ouzbekChallengeConfig" && <OuzbekChallengeConfigPhase />}
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

      {/* Mode Téléphone Ouzbek (cf. §3.13) */}
      {phase === "recordingP1" && <RecordingP1Phase audioContextFactory={getAudioContext} />}
      {phase === "handoffP2" && (
        <HandoffPhase player={2} others={[1, 3, 4]} onContinue={startGuessingP2} />
      )}
      {phase === "guessingP2" && <GuessingP2Phase audioContextFactory={getAudioContext} />}
      {phase === "handoffP3" && (
        <HandoffPhase player={3} others={[1, 2, 4]} onContinue={startRecordingP3} />
      )}
      {phase === "recordingP3" && <RecordingP3Phase audioContextFactory={getAudioContext} />}
      {phase === "handoffP4" && (
        <HandoffPhase player={4} others={[1, 2, 3]} onContinue={startGuessingP4} />
      )}
      {phase === "guessingP4" && <GuessingP4Phase audioContextFactory={getAudioContext} />}
      {phase === "revealOuzbek" && <RevealOuzbekPhase audioContextFactory={getAudioContext} />}

      <UpdatePrompt />
    </main>
  );
}
