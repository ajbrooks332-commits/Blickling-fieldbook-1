import { apiJson } from "./api";

/**
 * Account-partitioned, versioned structured-data store for offline use.
 * One IndexedDB database per user+property so logout/account-switch can
 * remove exactly one account's data without touching another's.
 */
const STORE_VERSION = 1;
const DATASET = "dataset";
const META = "meta";
const PHOTOS = "photos";
const PRIVATE_CACHE = "fieldbook-private-v1";

export const OFFLINE_COLLECTIONS = [
  "categories", "locations", "activityTypes", "users", "observations",
  "actions", "notes", "activities", "activityParticipants", "activityLocations", "observationImages",
] as const;
export type OfflineCollection = (typeof OFFLINE_COLLECTIONS)[number];

export interface OfflineMeta {
  lastSyncAt: string;        // device clock at completion
  serverTime: string;        // server clock at snapshot
  counts: Record<string, number>;
  complete: boolean;         // true only when every collection stored successfully
  lastAuthAt: string;        // last successful ONLINE authentication (lease anchor)
}

const AUTH_LEASE_MS = 8 * 60 * 60 * 1000;

const dbName = (userId: number, propertyId: number) => `blickling-fieldbook-data-u${userId}-p${propertyId}-v${STORE_VERSION}`;

function openStore(userId: number, propertyId: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(userId, propertyId), 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATASET)) db.createObjectStore(DATASET);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(userId: number, propertyId: number, storeName: string, mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openStore(userId, propertyId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = work(tx.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* unsupported */ }
  return false;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* unsupported */ }
  return null;
}

interface Snapshot {
  serverTime: string;
  propertyId: number;
  [collection: string]: unknown;
}

/** Downscale an image blob to a compressed thumbnail (~320px long edge). */
async function makeThumbnail(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
  } catch { return null; }
}

/**
 * Preload compressed thumbnails for structured-record photos, and optionally
 * full-resolution copies for current/open records (explicit opt-in only —
 * historic full-resolution images are never bulk-fetched).
 */
async function preloadPhotos(userId: number, propertyId: number, snapshot: Snapshot, includeFullRes: boolean): Promise<number> {
  const images = (snapshot.observationImages ?? []) as Array<Record<string, unknown>>;
  const observations = (snapshot.observations ?? []) as Array<Record<string, unknown>>;
  const openObservationIds = new Set(observations.filter((o) => o.status !== "closed").map((o) => o.id as number));
  let stored = 0;
  const cache = includeFullRes && "caches" in window ? await window.caches.open(PRIVATE_CACHE) : null;
  for (const image of images) {
    const storageKey = String(image.storageKey ?? "");
    if (!storageKey.startsWith("/objects/")) continue;
    const url = `/api/storage${storageKey}`;
    try {
      const existing = await withStore<Blob | undefined>(userId, propertyId, PHOTOS, "readonly", (store) => store.get(storageKey));
      const wantFull = cache && openObservationIds.has(image.observationId as number);
      if (existing && !wantFull) { stored += 1; continue; }
      const response = await fetch(url, { credentials: "same-origin", headers: { "X-Requested-With": "BlicklingFieldbook" } });
      if (!response.ok) continue;
      if (wantFull) await cache!.put(url, response.clone());
      if (!existing) {
        const thumbnail = await makeThumbnail(await response.blob());
        if (thumbnail) await withStore(userId, propertyId, PHOTOS, "readwrite", (store) => store.put(thumbnail, storageKey));
      }
      stored += 1;
    } catch { /* photo failures never fail the structured preload */ }
  }
  return stored;
}

export async function readOfflineThumbnail(userId: number, propertyId: number, storageKey: string): Promise<Blob | null> {
  try {
    return (await withStore<Blob | undefined>(userId, propertyId, PHOTOS, "readonly", (store) => store.get(storageKey))) ?? null;
  } catch { return null; }
}

/** Deliberate preload: fetch the whole active dataset and store it locally. */
export async function preloadOfflineData(userId: number, propertyId: number, options?: { fullResOpenRecords?: boolean }): Promise<OfflineMeta> {
  const snapshot = await apiJson<Snapshot>("/api/offline/snapshot");
  const counts: Record<string, number> = {};
  for (const collection of OFFLINE_COLLECTIONS) {
    const rows = (snapshot[collection] ?? []) as unknown[];
    await withStore(userId, propertyId, DATASET, "readwrite", (store) => store.put(rows, collection));
    counts[collection] = rows.length;
  }
  counts.photoThumbnails = await preloadPhotos(userId, propertyId, snapshot, options?.fullResOpenRecords ?? false);
  const previous = await getOfflineMeta(userId, propertyId);
  const meta: OfflineMeta = {
    lastSyncAt: new Date().toISOString(),
    serverTime: snapshot.serverTime,
    counts,
    complete: true,
    lastAuthAt: previous?.lastAuthAt ?? new Date().toISOString(),
  };
  await withStore(userId, propertyId, META, "readwrite", (store) => store.put(meta, "meta"));
  await requestPersistentStorage();
  return meta;
}

export async function getOfflineMeta(userId: number, propertyId: number): Promise<OfflineMeta | null> {
  try {
    return (await withStore<OfflineMeta | undefined>(userId, propertyId, META, "readonly", (store) => store.get("meta"))) ?? null;
  } catch { return null; }
}

export async function readOfflineCollection<T>(userId: number, propertyId: number, collection: OfflineCollection): Promise<T[]> {
  try {
    return (await withStore<T[] | undefined>(userId, propertyId, DATASET, "readonly", (store) => store.get(collection))) ?? [];
  } catch { return []; }
}

/** Record a successful ONLINE authentication — starts the 8-hour offline lease. */
export async function recordOnlineAuth(userId: number, propertyId: number): Promise<void> {
  const meta = await getOfflineMeta(userId, propertyId);
  const next: OfflineMeta = meta
    ? { ...meta, lastAuthAt: new Date().toISOString() }
    : { lastSyncAt: "", serverTime: "", counts: {}, complete: false, lastAuthAt: new Date().toISOString() };
  await withStore(userId, propertyId, META, "readwrite", (store) => store.put(next, "meta")).catch(() => undefined);
}

export type LeaseState = { valid: true; expiresAt: string } | { valid: false; expiredAt: string | null };

/** Offline authorisation lease: 8 hours from the last successful online auth. */
export async function offlineLeaseState(userId: number, propertyId: number): Promise<LeaseState> {
  const meta = await getOfflineMeta(userId, propertyId);
  if (!meta?.lastAuthAt) return { valid: false, expiredAt: null };
  const expires = Date.parse(meta.lastAuthAt) + AUTH_LEASE_MS;
  if (Date.now() < expires) return { valid: true, expiresAt: new Date(expires).toISOString() };
  return { valid: false, expiredAt: new Date(expires).toISOString() };
}

/**
 * Remove this account's cached dataset (not the outbox — unsynced work is
 * preserved separately and must be discarded explicitly per item).
 */
export async function clearOfflineData(userId: number, propertyId: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName(userId, propertyId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
