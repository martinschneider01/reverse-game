import { useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { MenuPhase } from "@/phases/MenuPhase";
import { PermissionPhase } from "@/phases/PermissionPhase";
import { PermissionDeniedPhase } from "@/phases/PermissionDeniedPhase";
import { HandoffAPhase } from "@/phases/HandoffAPhase";
import { RecordingAPhase } from "@/phases/RecordingAPhase";
import { DonePhase } from "@/phases/DonePhase";

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const phase = useGameStore((s) => s.phase);

  function getAudioContext(): AudioContext {
    if (audioContextRef.current === null) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  return (
    <main>
      {phase === "menu" && <MenuPhase />}
      {phase === "permission" && <PermissionPhase />}
      {phase === "permissionDenied" && <PermissionDeniedPhase />}
      {phase === "handoffA" && <HandoffAPhase />}
      {phase === "recordingA" && <RecordingAPhase audioContextFactory={getAudioContext} />}
      {phase === "done" && <DonePhase />}
    </main>
  );
}
