// Persists round state to IndexedDB so a user whose phone screen-locks (and
// whose PWA gets unloaded by the browser after a few minutes in background)
// can resume their round on next open. AudioBuffers don't survive — we
// persist the source Opus/WebM Blob and re-decode/re-reverse on hydration.
//
// We serialize Blobs as { data: ArrayBuffer, mimeType: string } rather than
// storing them directly: while browsers' IDB supports Blob values, some
// embedded structured-clone implementations don't (notably Node's, which
// matters for tests via fake-indexeddb). Going through ArrayBuffer is portable
// and the round-trip cost on a ~50 KB Opus blob is negligible.

const DB_NAME = "reverso";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "current";

export type PersistedRecording = {
  blob: Blob;
  durationMs: number;
};

export type PersistedPhase = "guessing" | "confirmEnd" | "reveal";

export type PersistedChallengeRules = {
  timerMs: number | null;
  notesEnabled: boolean;
  listenLimit: number | null;
};

export type PersistedState = {
  version: 1;
  phase: PersistedPhase;
  originalRecording: PersistedRecording | null;
  guessRecording: PersistedRecording | null;
  notes: string;
  listenCount: number;
  challengeRules: PersistedChallengeRules | null;
};

type RawRecording = {
  data: ArrayBuffer;
  mimeType: string;
  durationMs: number;
};

type RawState = {
  version: 1;
  phase: PersistedPhase;
  originalRecording: RawRecording | null;
  guessRecording: RawRecording | null;
  notes: string;
  listenCount: number;
  // Optional: pre-Mode-Challenge saves don't carry this field. Read with `?? null`.
  challengeRules?: PersistedChallengeRules | null;
};

async function toRaw(rec: PersistedRecording): Promise<RawRecording> {
  return {
    data: await rec.blob.arrayBuffer(),
    mimeType: rec.blob.type,
    durationMs: rec.durationMs,
  };
}

function fromRaw(raw: RawRecording): PersistedRecording {
  return {
    blob: new Blob([raw.data], { type: raw.mimeType }),
    durationMs: raw.durationMs,
  };
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onblocked = () => reject(new Error("indexedDB open blocked"));
  });
}

export async function loadPersistedState(): Promise<PersistedState | null> {
  if (!hasIndexedDb()) return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  try {
    const raw = await new Promise<RawState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve((req.result as RawState | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("indexedDB get failed"));
    });
    if (raw === null) return null;
    return {
      version: raw.version,
      phase: raw.phase,
      originalRecording: raw.originalRecording !== null ? fromRaw(raw.originalRecording) : null,
      guessRecording: raw.guessRecording !== null ? fromRaw(raw.guessRecording) : null,
      notes: raw.notes,
      listenCount: raw.listenCount,
      challengeRules: raw.challengeRules ?? null,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  if (!hasIndexedDb()) return;
  let raw: RawState;
  try {
    raw = {
      version: state.version,
      phase: state.phase,
      originalRecording:
        state.originalRecording !== null ? await toRaw(state.originalRecording) : null,
      guessRecording: state.guessRecording !== null ? await toRaw(state.guessRecording) : null,
      notes: state.notes,
      listenCount: state.listenCount,
      challengeRules: state.challengeRules,
    };
  } catch {
    return;
  }
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(raw, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB put failed"));
      tx.onabort = () => reject(tx.error ?? new Error("indexedDB put aborted"));
    });
  } catch {
    // Best-effort: a quota error or transient failure shouldn't crash the app.
  } finally {
    db.close();
  }
}

export async function clearPersistedState(): Promise<void> {
  if (!hasIndexedDb()) return;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
      tx.onabort = () => reject(tx.error ?? new Error("indexedDB delete aborted"));
    });
  } catch {
    // ignore
  } finally {
    db.close();
  }
}
