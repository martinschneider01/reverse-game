export type Recorder = {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  cancel: () => void;
};

export type RecorderOptions = {
  maxDurationMs: number;
  // Issue #18: by default the browser enables AGC, NS, and EC which together
  // can drop the captured level several dB. For a reverse-voice party game we
  // want the rawest possible signal, so we disable all three by default.
  // Callers can override per-constraint if needed.
  audioConstraints?: MediaTrackConstraints;
};

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  autoGainControl: false,
  noiseSuppression: false,
  echoCancellation: false,
};

type Session = {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mimeType: string;
  timeoutId: ReturnType<typeof setTimeout> | null;
  finalize: Promise<Blob>;
  active: boolean;
  cancelled: boolean;
};

export function createRecorder(options: RecorderOptions): Recorder {
  let session: Session | null = null;

  function clearTimer(s: Session): void {
    if (s.timeoutId !== null) {
      clearTimeout(s.timeoutId);
      s.timeoutId = null;
    }
  }

  function stopTracks(s: Session): void {
    for (const track of s.stream.getTracks()) {
      track.stop();
    }
  }

  function requestStop(s: Session): void {
    clearTimer(s);
    if (s.mediaRecorder.state !== "inactive") {
      s.mediaRecorder.stop();
    }
  }

  return {
    async start() {
      if (session !== null && session.active) {
        throw new Error("Recorder is already recording");
      }

      const audio = options.audioConstraints ?? DEFAULT_AUDIO_CONSTRAINTS;
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      const mediaRecorder = new MediaRecorder(stream);

      let resolveFinal!: (blob: Blob) => void;
      let rejectFinal!: (err: unknown) => void;
      const finalize = new Promise<Blob>((resolve, reject) => {
        resolveFinal = resolve;
        rejectFinal = reject;
      });

      const s: Session = {
        mediaRecorder,
        stream,
        chunks: [],
        mimeType: mediaRecorder.mimeType || "audio/webm",
        timeoutId: null,
        finalize,
        active: true,
        cancelled: false,
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          s.chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearTimer(s);
        stopTracks(s);
        s.active = false;
        if (s.cancelled) return;
        resolveFinal(new Blob(s.chunks, { type: s.mimeType }));
      };

      mediaRecorder.onerror = (event: Event) => {
        const err =
          (event as unknown as { error?: Error }).error ?? new Error("MediaRecorder error");
        clearTimer(s);
        stopTracks(s);
        s.active = false;
        rejectFinal(err);
      };

      session = s;
      mediaRecorder.start();

      s.timeoutId = setTimeout(() => {
        s.timeoutId = null;
        requestStop(s);
      }, options.maxDurationMs);
    },

    async stop() {
      const s = session;
      if (s === null) {
        throw new Error("Recorder is not recording");
      }
      requestStop(s);
      return s.finalize;
    },

    cancel() {
      const s = session;
      if (s === null) return;
      s.cancelled = true;
      s.active = false;
      session = null;
      clearTimer(s);
      if (s.mediaRecorder.state !== "inactive") {
        s.mediaRecorder.stop();
      }
      stopTracks(s);
    },
  };
}
