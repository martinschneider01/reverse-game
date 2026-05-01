import { useRef, useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);

  function getAudioContext(): AudioContext {
    if (audioContextRef.current === null) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  return (
    <main>
      <h1>Reverso</h1>
      <p>Démo audio — enregistre puis écoute ta voix.</p>
      <AudioRecorder
        maxDurationMs={15000}
        onRecorded={setBuffer}
        audioContextFactory={getAudioContext}
      />
      {buffer !== null && <AudioPlayer buffer={buffer} audioContext={getAudioContext()} />}
    </main>
  );
}
