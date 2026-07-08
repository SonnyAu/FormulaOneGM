// Browser-side persistence for user-created custom tracks.
//
// Custom tracks live in IndexedDB (per browser/device). Built-in tracks shipped
// in public/tracks/ are read-only and loaded via static fetch.

import type { TrackMetadata } from "@/lib/tracks/trackMetadata";

const DB_NAME = "f1gm-tracks";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

type StoredTrack = {
  id: string;
  metadata: TrackMetadata;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
      }),
  );
}

/** List ids of all custom tracks saved in this browser. */
export async function listCustomTrackIds(): Promise<string[]> {
  const rows = await withStore<StoredTrack[]>("readonly", (store) => store.getAll());
  return rows.map((row) => row.id).sort();
}

/** Load a custom track by id, or null if not stored locally. */
export async function getCustomTrack(id: string): Promise<TrackMetadata | null> {
  const row = await withStore<StoredTrack | undefined>("readonly", (store) => store.get(id));
  return row?.metadata ?? null;
}

/** Save or overwrite a custom track in IndexedDB. */
export async function saveCustomTrack(metadata: TrackMetadata): Promise<void> {
  const id = metadata.id.trim();
  if (!id) throw new Error("Track id is required to save.");
  const row: StoredTrack = { id, metadata: { ...metadata, id }, updatedAt: Date.now() };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(row));
}

/** Remove a custom track from IndexedDB. */
export async function deleteCustomTrack(id: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id));
}

/** Fetch the list of built-in track ids from the static manifest. */
export async function listBuiltInTrackIds(): Promise<string[]> {
  const res = await fetch("/tracks/index.json");
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter((id): id is string => typeof id === "string").sort();
}
