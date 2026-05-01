import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export type PermissionPhaseProps = {
  requestPermission?: () => Promise<MediaStream>;
};

function defaultRequestPermission(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("mediaDevices unavailable (insecure context?)"));
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function PermissionPhase({
  requestPermission = defaultRequestPermission,
}: PermissionPhaseProps) {
  const permissionGranted = useGameStore((s) => s.permissionGranted);
  const permissionDenied = useGameStore((s) => s.permissionDenied);

  useEffect(() => {
    let cancelled = false;
    // Promise.resolve().then(...) converts any synchronous throw from
    // requestPermission into a rejection — without this, an insecure-context
    // mobile browser (where navigator.mediaDevices is undefined) crashes the
    // React tree instead of routing to permissionDenied.
    Promise.resolve()
      .then(() => requestPermission())
      .then(
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
