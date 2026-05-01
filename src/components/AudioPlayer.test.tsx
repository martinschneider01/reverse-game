import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "./AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import type { Recording } from "@/audio/recording";

function makeFakePlayer(): {
  player: Player;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  setRate: ReturnType<typeof vi.fn>;
  setDirection: ReturnType<typeof vi.fn>;
  endedHandler: { current: (() => void) | null };
} {
  const load = vi.fn();
  const play = vi.fn();
  const pause = vi.fn();
  const setRate = vi.fn();
  const setDirection = vi.fn();
  const endedHandler: { current: (() => void) | null } = { current: null };
  const onEnded = vi.fn((cb: () => void) => {
    endedHandler.current = cb;
  });
  return {
    player: { load, play, pause, setRate, setDirection, onEnded },
    load,
    play,
    pause,
    setRate,
    setDirection,
    endedHandler,
  };
}

const fakeRecording: Recording = {
  forward: { numberOfChannels: 1, length: 4 } as unknown as AudioBuffer,
  reverse: { numberOfChannels: 1, length: 4 } as unknown as AudioBuffer,
  durationMs: 100,
};
const fakeCtx = {} as AudioContext;

describe("<AudioPlayer />", () => {
  it("loads the recording and plays it on click; toggles to Pause and back to Lecture", async () => {
    const user = userEvent.setup();
    const { player, load, play, pause } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(load).toHaveBeenCalledWith(fakeRecording);

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(play).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /lecture/i })).toBeInTheDocument();
  });

  it("returns to the Lecture state when the player reports the end of playback", async () => {
    const user = userEvent.setup();
    const { player, endedHandler } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    endedHandler.current?.();

    expect(await screen.findByRole("button", { name: /lecture/i })).toBeInTheDocument();
  });

  it("changing the speed slider calls setRate with the new value", () => {
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.5");

    expect(setRate).toHaveBeenLastCalledWith(0.5);
  });

  it("snaps the slider to 1.0 when the value is close to 1", () => {
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.97");

    expect(setRate).toHaveBeenLastCalledWith(1);
  });

  it("respects extreme slider values (0.25 and 2.0)", () => {
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.25");
    expect(setRate).toHaveBeenLastCalledWith(0.25);

    fireChange(slider, "2");
    expect(setRate).toHaveBeenLastCalledWith(2);
  });

  it("clicking the direction toggle calls setDirection with the opposite direction", async () => {
    const user = userEvent.setup();
    const { player, setDirection } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    const toggle = screen.getByRole("button", { name: /sens/i });
    await user.click(toggle);
    expect(setDirection).toHaveBeenLastCalledWith("reverse");

    await user.click(screen.getByRole("button", { name: /sens/i }));
    expect(setDirection).toHaveBeenLastCalledWith("forward");
  });

  it("fires onPlay when the user starts playback (not when pausing)", async () => {
    const user = userEvent.setup();
    const { player } = makeFakePlayer();
    const onPlay = vi.fn();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        onPlay={onPlay}
      />,
    );

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /lecture/i }));
    expect(onPlay).toHaveBeenCalledTimes(2);
  });

  it("starts with the configured initialDirection", () => {
    const { player, setDirection } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        initialDirection="reverse"
      />,
    );

    expect(setDirection).toHaveBeenCalledWith("reverse");
  });
});

function fireChange(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}
