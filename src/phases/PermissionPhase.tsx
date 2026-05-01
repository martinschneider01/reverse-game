import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export type PermissionPhaseProps = {
  requestPermission?: () => Promise<MediaStream>;
};

function defaultRequestPermission(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function PermissionPhase({
  requestPermission = defaultRequestPermission,
}: PermissionPhaseProps) {
  const permissionGranted = useGameStore((s) => s.permissionGranted);
  const permissionDenied = useGameStore((s) => s.permissionDenied);

  useEffect(() => {
    let cancelled = false;
    requestPermission().then(
      (stream) => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        if (!cancelled) permissionGranted();
      },
      () => {
        if (!cancelled) permissionDenied();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [requestPermission, permissionGranted, permissionDenied]);

  return (
    <section className="center-screen">
      <p className="kicker">Préparation</p>
      <h2>Autorisation micro</h2>
      <p>Accepte la demande d'accès au micro pour démarrer la partie.</p>
    </section>
  );
}
