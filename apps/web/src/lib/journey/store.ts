// IndexedDB persistence for journey recording: the offline first pattern
// proven by the conductor cache (apps/conductor/src/lib/offlineStore.ts),
// hand rolled the same way; three stores do not justify a dependency.
//
// What lives on the phone and why that is the point:
//   journeys  the recording facts (status, counts, how far the sync got)
//   points    every accepted GPS fix, written the moment it is accepted so
//             a crash or reload never loses the trace
//   meta      the active recording id, so a reload can resume
//
// The trace stays here until the rider saves with journey consent; without
// consent nothing ever leaves this database (M1 law).

export type LocalJourneyStatus = "recording" | "complete" | "discarded";
export type LocalJourneyMode = "kombi" | "walk" | "mixed";

export interface LocalJourney {
  id: string;
  mode: LocalJourneyMode;
  status: LocalJourneyStatus;
  /** Epoch ms. */
  startedAt: number;
  endedAt?: number;
  name?: string;
  distanceM: number;
  pointCount: number;
  /** Highest seq the server has confirmed; -1 before any sync. */
  syncedThrough: number;
  /** The server knows this journey row exists. */
  serverKnown: boolean;
  /** complete/discard has been confirmed by the server. */
  statusSynced: boolean;
  /** A replayed batch met rows that were already there: flagged, not hidden. */
  conflict: boolean;
}

export interface LocalPoint {
  journeyId: string;
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number;
  /** Epoch ms. */
  recordedAt: number;
}

const DB_NAME = "svika-journey";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("journeys")) {
        db.createObjectStore("journeys", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("points")) {
        db.createObjectStore("points", { keyPath: ["journeyId", "seq"] });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb open failed"));
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb request failed"));
  });
}

async function store(
  name: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function putJourney(j: LocalJourney): Promise<void> {
  await request((await store("journeys", "readwrite")).put(j));
}

export async function getJourney(id: string): Promise<LocalJourney | undefined> {
  return (await request((await store("journeys", "readonly")).get(id))) as
    | LocalJourney
    | undefined;
}

export async function listJourneys(): Promise<LocalJourney[]> {
  return (await request(
    (await store("journeys", "readonly")).getAll(),
  )) as LocalJourney[];
}

export async function deleteJourney(id: string): Promise<void> {
  await request((await store("journeys", "readwrite")).delete(id));
  await deletePoints(id);
}

export async function addPoint(p: LocalPoint): Promise<void> {
  await request((await store("points", "readwrite")).put(p));
}

export async function listPoints(journeyId: string): Promise<LocalPoint[]> {
  const range = IDBKeyRange.bound([journeyId, 0], [journeyId, Infinity]);
  const rows = (await request(
    (await store("points", "readonly")).getAll(range),
  )) as LocalPoint[];
  return rows.sort((a, b) => a.seq - b.seq);
}

export async function deletePoints(journeyId: string): Promise<void> {
  const range = IDBKeyRange.bound([journeyId, 0], [journeyId, Infinity]);
  await request((await store("points", "readwrite")).delete(range));
}

export async function getActiveJourneyId(): Promise<string | undefined> {
  const row = (await request((await store("meta", "readonly")).get("active"))) as
    | { key: string; value: string }
    | undefined;
  return row?.value;
}

export async function setActiveJourneyId(id: string | null): Promise<void> {
  const s = await store("meta", "readwrite");
  if (id === null) await request(s.delete("active"));
  else await request(s.put({ key: "active", value: id }));
}
