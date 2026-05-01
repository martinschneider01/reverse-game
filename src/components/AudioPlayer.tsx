import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPlayer, type Player } from "@/audio/wrappers/player";
import type { Direction, Recording } from "@/audio/recording";
import { usePlaybackStore } from "@/store/playbackStore";

export type AudioPlayerProps = {
  recording: Recording;
  audioContext: AudioContext;
  initialDirection?: Direction;
  lockDirection?: Direction;
  showRateControl?: boolean;
  playerFactory?: (ctx: AudioContext) => Player;
  onPlay?: () => void;
  onClose?: () => void;
};

const MIN_RATE = 0.25;
const MAX_RATE = 2;
const SNAP_RANGE = 0.05;
const WAVEFORM_BARS = 32;

function snap(rate: number): number {
  return Math.abs(rate - 1) <= SNAP_RANGE ? 1 : rate;
}

function computeBars(buffer: AudioBuffer): number[] {
  if (typeof buffer.getChannelData !== "function") {
    return Array.from<number>({ length: WAVEFORM_BARS }).fill(0);
  }
  const data = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(data.length / WAVEFORM_BARS));
  const heights: number[] = [];
  let max = 0;
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    const start = i * bucketSize;
    const end = i === WAVEFORM_BARS - 1 ? data.length : Math.min(start + bucketSize, data.length);
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      const v = data[j] ?? 0;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, end - start));
    heights.push(rms);
    if (rms > max) max = rms;
  }
  return max > 0 ? heights.map((h) => h / max) : heights;
}

export function AudioPlayer({
  recording,
  audioContext,
  initialDirection = "forward",
  lockDirection,
  showRateControl = true,
  playerFactory = createPlayer,
  onPlay,
  onClose,
}: AudioPlayerProps) {
  const effectiveInitialDirection: Direction = lockDirection ?? initialDirection;
  const playerId = useId();
  const playerRef = useRef<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [direction, setDirection] = useState<Direction>(effectiveInitialDirection);
  const [rateRevealed, setRateRevealed] = useState(false);
  const [positionFrac, setPositionFrac] = useState(0);

  const rateRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<number | null>(null);

  const currentPlayingId = usePlaybackStore((s) => s.currentPlayingId);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const clearPlaying = usePlaybackStore((s) => s.clearPlaying);

  const bars = useMemo(() => computeBars(recording.forward), [recording]);

  if (playerRef.current === null) {
    const p = playerFactory(audioContext);
    p.onEnded(() => {
      setIsPlaying(false);
      clearPlaying(playerId);
      stopTracking();
    });
    if (effectiveInitialDirection !== "forward") {
      p.setDirection(effectiveInitialDirection);
    }
    playerRef.current = p;
  }

  useEffect(() => {
    playerRef.current?.load(recording);
  }, [recording]);

  useEffect(() => {
    if (isPlaying && currentPlayingId !== null && currentPlayingId !== playerId) {
      playerRef.current?.pause();
      setIsPlaying(false);
      stopTracking();
    }
  }, [currentPlayingId, isPlaying, playerId]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  function startTracking(): void {
    setPositionFrac(0);
    playStartRef.current = performance.now();
    const loop = (): void => {
      if (playStartRef.current === null) return;
      const wallElapsedMs = performance.now() - playStartRef.current;
      const audioElapsedMs = wallElapsedMs * rateRef.current;
      const frac = Math.min(audioElapsedMs / Math.max(1, recording.durationMs), 1);
      setPositionFrac(frac);
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function stopTracking(): void {
    playStartRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPositionFrac(0);
  }

  function handlePlayDirection(target: Direction): void {
    const player = playerRef.current;
    if (player === null) return;

    if (isPlaying && direction === target) {
      player.pause();
      setIsPlaying(false);
      clearPlaying(playerId);
      stopTracking();
      return;
    }

    if (direction !== target) {
      player.setDirection(target);
      setDirection(target);
    }
    player.play();
    setIsPlaying(true);
    setPlaying(playerId);
    onPlay?.();
    startTracking();
  }

  function handleRateChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const raw = Number.parseFloat(event.target.value);
    const next = snap(raw);
    setRate(next);
    rateRef.current = next;
    playerRef.current?.setRate(next);
  }

  const forwardActive = isPlaying && direction === "forward";
  const reverseActive = isPlaying && direction === "reverse";
  const forwardDisabled = lockDirection === "reverse";
  const reverseDisabled = lockDirection === "forward";

  const playheadFrac = direction === "reverse" ? 1 - positionFrac : positionFrac;

  return (
    <div className="audio-player">
      {onClose !== undefined && (
        <button type="button" className="audio-player-close" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      )}

      <div className="audio-player-waveform" aria-hidden="true">
        {bars.map((height, i) => (
          <span
            key={i}
            className="audio-player-bar"
            style={{ height: `${Math.max(8, height * 100)}%` }}
          />
        ))}
        {isPlaying && (
          <span
            className="audio-player-playhead"
            data-testid="playhead"
            data-position={playheadFrac.toFixed(4)}
            style={{ left: `${playheadFrac * 100}%` }}
          />
        )}
      </div>

      <div className="audio-player-controls">
        <button
          type="button"
          className="audio-player-direction-btn"
          aria-label={forwardActive ? "Pause" : "Lecture à l'endroit"}
          aria-pressed={forwardActive}
          disabled={forwardDisabled}
          onClick={() => handlePlayDirection("forward")}
        >
          {forwardActive ? <PauseIcon /> : <PlayIcon mirrored={false} />}
        </button>
        <button
          type="button"
          className="audio-player-direction-btn"
          aria-label={reverseActive ? "Pause" : "Lecture à l'envers"}
          aria-pressed={reverseActive}
          disabled={reverseDisabled}
          onClick={() => handlePlayDirection("reverse")}
        >
          {reverseActive ? <PauseIcon /> : <PlayIcon mirrored={true} />}
        </button>

        {showRateControl && (
          <button
            type="button"
            className="audio-player-gear"
            aria-label="Réglages vitesse"
            aria-pressed={rateRevealed}
            onClick={() => setRateRevealed((v) => !v)}
          >
            <GearIcon />
          </button>
        )}
      </div>

      {showRateControl && rateRevealed && (
        <label className="audio-player-rate">
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
      )}
    </div>
  );
}

function PlayIcon({ mirrored }: { mirrored: boolean }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
    </svg>
  );
}

function GearIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7 7 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.77 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96a7 7 0 0 0 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        fill="currentColor"
      />
    </svg>
  );
}
