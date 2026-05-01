import { useEffect, useRef, useState } from "react";
import { createPlayer, type Player } from "@/audio/wrappers/player";

export type AudioPlayerProps = {
  buffer: AudioBuffer;
  audioContext: AudioContext;
  playerFactory?: (ctx: AudioContext) => Player;
};

export function AudioPlayer({
  buffer,
  audioContext,
  playerFactory = createPlayer,
}: AudioPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (playerRef.current === null) {
    playerRef.current = playerFactory(audioContext);
    playerRef.current.onEnded(() => setIsPlaying(false));
  }

  useEffect(() => {
    playerRef.current?.load(buffer);
  }, [buffer]);

  function handleToggle() {
    const player = playerRef.current;
    if (player === null) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }

  return (
    <button type="button" onClick={handleToggle}>
      {isPlaying ? "Pause" : "Lecture"}
    </button>
  );
}
