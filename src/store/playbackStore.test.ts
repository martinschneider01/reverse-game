import { describe, it, expect, beforeEach } from "vitest";
import { usePlaybackStore, INITIAL_PLAYBACK_STATE } from "./playbackStore";

function reset(): void {
  usePlaybackStore.setState({ ...INITIAL_PLAYBACK_STATE });
}

describe("playbackStore", () => {
  beforeEach(reset);

  it("starts with no current playing id", () => {
    expect(usePlaybackStore.getState().currentPlayingId).toBeNull();
  });

  it("setPlaying records the active id", () => {
    usePlaybackStore.getState().setPlaying("a");
    expect(usePlaybackStore.getState().currentPlayingId).toBe("a");
  });

  it("setPlaying replaces a previous active id", () => {
    usePlaybackStore.getState().setPlaying("a");
    usePlaybackStore.getState().setPlaying("b");
    expect(usePlaybackStore.getState().currentPlayingId).toBe("b");
  });

  it("clearPlaying clears when the id matches the current", () => {
    usePlaybackStore.getState().setPlaying("a");
    usePlaybackStore.getState().clearPlaying("a");
    expect(usePlaybackStore.getState().currentPlayingId).toBeNull();
  });

  it("clearPlaying is a no-op when the id does not match", () => {
    usePlaybackStore.getState().setPlaying("a");
    usePlaybackStore.getState().clearPlaying("b");
    expect(usePlaybackStore.getState().currentPlayingId).toBe("a");
  });
});
