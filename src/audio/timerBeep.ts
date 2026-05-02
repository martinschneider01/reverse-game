/** Short attention beep emitted during the last 10 seconds of a Mode Challenge
 *  timer (cf. PROJECT.md §3.12, issue #33). 880 Hz sine, ~150 ms with a tiny
 *  attack/decay envelope so it doesn't click. The hook (useGuessingTimer)
 *  decides when to call this and inhibits the call when an AudioPlayer or
 *  AudioRecorder is active. */
export function playTimerBeep(ctx: AudioContext): void {
  if (typeof ctx.createOscillator !== "function" || typeof ctx.createGain !== "function") {
    return;
  }
  const start = ctx.currentTime;
  const duration = 0.18;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  // Envelope: 10 ms attack, 170 ms exponential decay. Floor at 0.0001 because
  // exponentialRampToValueAtTime cannot reach zero.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}
