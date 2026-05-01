import { useRef, useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { Recording } from "@/audio/recording";

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);

  function getAudioContext(): AudioContext {
    if (audioContextRef.current === null) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  return (
    <main>
      <h1>Reverso</h1>
      <p>Démo audio — enregistre puis écoute ta voix à l'endroit ou à l'envers.</p>
      <AudioRecorder
        maxDurationMs={15000}
        onRecorded={setRecording}
        audioContextFactory={getAudioContext}
      />
      {recording !== null && <AudioPlayer recording={recording} audioContext={getAudioContext()} />}
    </main>
  );
}
