import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "./AudioPlayer";
import type { Player } from "@/audio/wrappers/player";

function makeFakePlayer(): {
  player: Player;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  endedHandler: { current: (() => void) | null };
} {
  const load = vi.fn();
  const play = vi.fn();
  const pause = vi.fn();
  const endedHandler: { current: (() => void) | null } = { current: null };
  const onEnded = vi.fn((cb: () => void) => {
    endedHandler.current = cb;
  });
  return {
    player: { load, play, pause, onEnded },
    load,
    play,
    pause,
    endedHandler,
  };
}

const fakeBuffer = { numberOfChannels: 1, length: 4 } as unknown as AudioBuffer;
const fakeCtx = {} as AudioContext;

describe("<AudioPlayer />", () => {
  it("loads the buffer and plays it on click; toggles to Pause and back to Lecture", async () => {
    const user = userEvent.setup();
    const { player, load, play, pause } = makeFakePlayer();

    render(<AudioPlayer buffer={fakeBuffer} audioContext={fakeCtx} playerFactory={() => player} />);

    expect(load).toHaveBeenCalledWith(fakeBuffer);

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(play).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /lecture/i })).toBeInTheDocument();
  });

  it("returns to the Lecture state when the player reports the end of playback", async () => {
    const user = userEvent.setup();
    const { player, endedHandler } = makeFakePlayer();

    render(<AudioPlayer buffer={fakeBuffer} audioContext={fakeCtx} playerFactory={() => player} />);

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    endedHandler.current?.();

    expect(await screen.findByRole("button", { name: /lecture/i })).toBeInTheDocument();
  });
});
