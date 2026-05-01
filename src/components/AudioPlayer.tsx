import { useEffect, useRef, useState } from "react";
import { createPlayer, type Player } from "@/audio/wrappers/player";
import type { Direction, Recording } from "@/audio/recording";

export type AudioPlayerProps = {
  recording: Recording;
  audioContext: AudioContext;
  initialDirection?: Direction;
  playerFactory?: (ctx: AudioContext) => Player;
};

const MIN_RATE = 0.25;
const MAX_RATE = 2;
const SNAP_RANGE = 0.05;

function snap(rate: number): number {
  return Math.abs(rate - 1) <= SNAP_RANGE ? 1 : rate;
}

export function AudioPlayer({
  recording,
  audioContext,
  initialDirection = "forward",
  playerFactory = createPlayer,
}: AudioPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [direction, setDirection] = useState<Direction>(initialDirection);

  if (playerRef.current === null) {
    const p = playerFactory(audioContext);
    p.onEnded(() => setIsPlaying(false));
    if (initialDirection !== "forward") {
      p.setDirection(initialDirection);
    }
    playerRef.current = p;
  }

  useEffect(() => {
    playerRef.current?.load(recording);
  }, [recording]);

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

  function handleRateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number.parseFloat(event.target.value);
    const next = snap(raw);
    setRate(next);
    playerRef.current?.setRate(next);
  }

  function handleToggleDirection() {
    const next: Direction = direction === "forward" ? "reverse" : "forward";
    setDirection(next);
    playerRef.current?.setDirection(next);
  }

  return (
    <div>
      <button type="button" onClick={handleToggle}>
        {isPlaying ? "Pause" : "Lecture"}
      </button>
      <button type="button" onClick={handleToggleDirection}>
        Sens : {direction === "forward" ? "à l'endroit" : "à l'envers"}
      </button>
      <label>
        Vitesse : {rate.toFixed(2)}×
        <input
          type="range"
          min={MIN_RATE}
          max={MAX_RATE}
          step={0.01}
          value={rate}
          onChange={handleRateChange}
          aria-label="Vitesse"
        />
      </label>
    </div>
  );
}
