import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AudioPlayer } from "./AudioPlayer";
import type { Player } from "@/audio/wrappers/player";
import type { Recording } from "@/audio/recording";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "@/store/playbackStore";

function makeFakePlayer(): {
  player: Player;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  setRate: ReturnType<typeof vi.fn>;
  setDirection: ReturnType<typeof vi.fn>;
  setGain: ReturnType<typeof vi.fn>;
  endedHandler: { current: (() => void) | null };
} {
  const load = vi.fn();
  const play = vi.fn();
  const pause = vi.fn();
  const setRate = vi.fn();
  const setDirection = vi.fn();
  const setGain = vi.fn();
  const endedHandler: { current: (() => void) | null } = { current: null };
  const onEnded = vi.fn((cb: () => void) => {
    endedHandler.current = cb;
  });
  return {
    player: { load, play, pause, setRate, setDirection, setGain, onEnded },
    load,
    play,
    pause,
    setRate,
    setDirection,
    setGain,
    endedHandler,
  };
}

const fakeRecording: Recording = {
  forward: { numberOfChannels: 1, length: 4 } as unknown as AudioBuffer,
  reverse: { numberOfChannels: 1, length: 4 } as unknown as AudioBuffer,
  durationMs: 100,
  blob: new Blob(),
};
const fakeCtx = {} as AudioContext;

describe("<AudioPlayer />", () => {
  beforeEach(() => {
    usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
  });

  it("loads the recording and starts playing forward when the forward button is clicked", async () => {
    const user = userEvent.setup();
    const { player, load, play, pause } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(load).toHaveBeenCalledWith(fakeRecording);

    const forward = screen.getByRole("button", { name: /lecture à l'endroit/i });
    await user.click(forward);
    expect(play).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^pause$/i }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeInTheDocument();
  });

  it("clicking the reverse button switches direction and plays", async () => {
    const user = userEvent.setup();
    const { player, play, setDirection } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /lecture à l'envers/i }));
    expect(setDirection).toHaveBeenLastCalledWith("reverse");
    expect(play).toHaveBeenCalled();
  });

  it("returns to the play state when the player reports the end of playback", async () => {
    const user = userEvent.setup();
    const { player, endedHandler } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /lecture à l'endroit/i }));
    expect(screen.getByRole("button", { name: /^pause$/i })).toBeInTheDocument();

    endedHandler.current?.();

    expect(await screen.findByRole("button", { name: /lecture à l'endroit/i })).toBeInTheDocument();
  });

  it("the speed slider is hidden behind a gear toggle and reveals it on click", async () => {
    const user = userEvent.setup();
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(screen.queryByRole("slider", { name: /vitesse/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /réglages vitesse/i }));
    expect(screen.getByRole("slider", { name: /vitesse/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /réglages vitesse/i }));
    expect(screen.queryByRole("slider", { name: /vitesse/i })).not.toBeInTheDocument();
  });

  it("changing the speed slider calls setRate with the new value", async () => {
    const user = userEvent.setup();
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /réglages vitesse/i }));
    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.5");

    expect(setRate).toHaveBeenLastCalledWith(0.5);
  });

  it("snaps the slider to 1.0 when the value is close to 1", async () => {
    const user = userEvent.setup();
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /réglages vitesse/i }));
    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.97");

    expect(setRate).toHaveBeenLastCalledWith(1);
  });

  it("respects extreme slider values (0.25 and 2.0)", async () => {
    const user = userEvent.setup();
    const { player, setRate } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /réglages vitesse/i }));
    const slider = screen.getByRole("slider", { name: /vitesse/i });
    fireChange(slider, "0.25");
    expect(setRate).toHaveBeenLastCalledWith(0.25);

    fireChange(slider, "2");
    expect(setRate).toHaveBeenLastCalledWith(2);
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

    await user.click(screen.getByRole("button", { name: /lecture à l'endroit/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /^pause$/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /lecture à l'endroit/i }));
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

  it("when lockDirection is set, the disallowed direction button stays visible but disabled", () => {
    const { player, setDirection } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        lockDirection="reverse"
      />,
    );

    expect(setDirection).toHaveBeenCalledWith("reverse");
    const forwardBtn = screen.getByRole("button", { name: /lecture à l'endroit/i });
    expect(forwardBtn).toBeDisabled();
    const reverseBtn = screen.getByRole("button", { name: /lecture à l'envers/i });
    expect(reverseBtn).not.toBeDisabled();
  });

  it("when disabled is true, both play buttons are disabled", () => {
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        disabled={true}
      />,
    );

    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).toBeDisabled();
  });

  it("disabled combined with lockDirection still disables the unlocked button", () => {
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        lockDirection="reverse"
        disabled={true}
      />,
    );

    expect(screen.getByRole("button", { name: /lecture à l'envers/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /lecture à l'endroit/i })).toBeDisabled();
  });

  it("hides the gear button (and slider) when showRateControl is false", () => {
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        showRateControl={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /réglages vitesse/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /vitesse/i })).not.toBeInTheDocument();
  });

  it("lockDirection takes precedence over initialDirection", () => {
    const { player, setDirection } = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        initialDirection="forward"
        lockDirection="reverse"
      />,
    );

    expect(setDirection).toHaveBeenCalledWith("reverse");
    const forwardBtn = screen.getByRole("button", { name: /lecture à l'endroit/i });
    expect(forwardBtn).toBeDisabled();
  });

  it("auto-pauses other AudioPlayer instances when one starts playing", async () => {
    const user = userEvent.setup();
    const a = makeFakePlayer();
    const b = makeFakePlayer();

    render(
      <>
        <AudioPlayer
          recording={fakeRecording}
          audioContext={fakeCtx}
          playerFactory={() => a.player}
        />
        <AudioPlayer
          recording={fakeRecording}
          audioContext={fakeCtx}
          playerFactory={() => b.player}
        />
      </>,
    );

    const playButtons = screen.getAllByRole("button", { name: /lecture à l'endroit/i });
    const playA = playButtons[0]!;
    const playB = playButtons[1]!;

    await user.click(playA);
    expect(a.play).toHaveBeenCalledTimes(1);
    expect(a.pause).not.toHaveBeenCalled();

    await user.click(playB);
    expect(b.play).toHaveBeenCalledTimes(1);
    expect(a.pause).toHaveBeenCalledTimes(1);
  });

  it("does not pause other instances when the user pauses a player", async () => {
    const user = userEvent.setup();
    const a = makeFakePlayer();
    const b = makeFakePlayer();

    render(
      <>
        <AudioPlayer
          recording={fakeRecording}
          audioContext={fakeCtx}
          playerFactory={() => a.player}
        />
        <AudioPlayer
          recording={fakeRecording}
          audioContext={fakeCtx}
          playerFactory={() => b.player}
        />
      </>,
    );

    const playA = screen.getAllByRole("button", { name: /lecture à l'endroit/i })[0]!;
    await user.click(playA);
    await user.click(screen.getByRole("button", { name: /^pause$/i }));

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();

    const playB = screen.getAllByRole("button", { name: /lecture à l'endroit/i })[1]!;
    await user.click(playB);
    expect(b.play).toHaveBeenCalledTimes(1);
    expect(a.pause).toHaveBeenCalledTimes(1);
  });

  it("clears the playback registration when natural end-of-buffer fires", async () => {
    const user = userEvent.setup();
    const a = makeFakePlayer();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => a.player}
      />,
    );

    await user.click(screen.getByRole("button", { name: /lecture à l'endroit/i }));
    expect(usePlaybackStore.getState().currentPlayingId).not.toBeNull();

    a.endedHandler.current?.();
    expect(usePlaybackStore.getState().currentPlayingId).toBeNull();
  });

  it("renders an onClose × button when onClose is provided and triggers it on click", async () => {
    const user = userEvent.setup();
    const { player } = makeFakePlayer();
    const onClose = vi.fn();

    render(
      <AudioPlayer
        recording={fakeRecording}
        audioContext={fakeCtx}
        playerFactory={() => player}
        onClose={onClose}
      />,
    );

    const close = screen.getByRole("button", { name: /fermer/i });
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render the onClose button when onClose is not provided", () => {
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(screen.queryByRole("button", { name: /fermer/i })).not.toBeInTheDocument();
  });

  it("renders a waveform with the configured number of bars", () => {
    const { player } = makeFakePlayer();

    const { container } = render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(container.querySelectorAll(".audio-player-bar").length).toBe(64);
  });
});

describe("<AudioPlayer /> playhead animation", () => {
  let now = 0;
  const rafCallbacks: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextRafId = 1;

  beforeEach(() => {
    usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
    now = 0;
    rafCallbacks.length = 0;
    nextRafId = 1;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextRafId++;
      rafCallbacks.push({ id, cb });
      return id;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      const idx = rafCallbacks.findIndex((entry) => entry.id === id);
      if (idx !== -1) rafCallbacks.splice(idx, 1);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushRaf(time: number): void {
    act(() => {
      const pending = rafCallbacks.splice(0, rafCallbacks.length);
      for (const entry of pending) entry.cb(time);
    });
  }

  it("renders an animated playhead whose position advances during playback", async () => {
    const user = userEvent.setup();
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    expect(screen.queryByTestId("playhead")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /lecture à l'endroit/i }));

    now = 0;
    flushRaf(0);
    expect(parseFloat(screen.getByTestId("playhead").dataset.position ?? "1")).toBeCloseTo(0, 2);

    now = 50;
    flushRaf(50);

    const pos = parseFloat(screen.getByTestId("playhead").dataset.position ?? "0");
    expect(pos).toBeGreaterThan(0);
    expect(pos).toBeLessThanOrEqual(1);
  });

  it("renders the playhead from right→left when playing in reverse", async () => {
    const user = userEvent.setup();
    const { player } = makeFakePlayer();

    render(
      <AudioPlayer recording={fakeRecording} audioContext={fakeCtx} playerFactory={() => player} />,
    );

    await user.click(screen.getByRole("button", { name: /lecture à l'envers/i }));

    now = 0;
    flushRaf(0);
    const startPos = parseFloat(screen.getByTestId("playhead").dataset.position ?? "0");
    expect(startPos).toBeCloseTo(1, 2);

    now = 50;
    flushRaf(50);
    const midPos = parseFloat(screen.getByTestId("playhead").dataset.position ?? "1");
    expect(midPos).toBeLessThan(1);
  });
});

function fireChange(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}
