const DB_NAME = "f1gm-local-db";
const DB_VERSION = 1;
const STORES = {
  saves: "saves",
  metadata: "metadata",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureClient() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("IndexedDB is unavailable in this environment.");
  }
}

function openDb(): Promise<IDBDatabase> {
  ensureClient();
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.saves)) {
        db.createObjectStore(STORES.saves, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

  return dbPromise;
}

async function runTransaction<T>(
  store: (typeof STORES)[keyof typeof STORES],
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const objectStore = tx.objectStore(store);
    const request = operation(objectStore);

    tx.onerror = () => reject(request.error ?? tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(request.error ?? tx.error ?? new Error("IndexedDB transaction aborted."));
    tx.oncomplete = () => resolve(request.result as T);
  });
}

export async function idbGet<T>(store: keyof typeof STORES, key: string): Promise<T | null> {
  const result = await runTransaction<T | undefined>(STORES[store], "readonly", (objectStore) =>
    objectStore.get(key),
  );
  return result ?? null;
}

export async function idbPut<T>(store: keyof typeof STORES, value: T): Promise<void> {
  await runTransaction(STORES[store], "readwrite", (objectStore) => objectStore.put(value));
}

export async function idbDelete(store: keyof typeof STORES, key: string): Promise<void> {
  await runTransaction(STORES[store], "readwrite", (objectStore) => objectStore.delete(key));
}

export async function idbGetAll<T>(store: keyof typeof STORES): Promise<T[]> {
  const result = await runTransaction<T[]>(STORES[store], "readonly", (objectStore) =>
    objectStore.getAll(),
  );
  return result ?? [];
}
