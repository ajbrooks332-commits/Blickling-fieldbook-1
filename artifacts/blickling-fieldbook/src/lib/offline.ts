import { ApiRequestError, apiJson } from "./api";

const DB_NAME = "blickling-fieldbook";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const PRIVATE_CACHE = "fieldbook-private-v1";

const notifyQueued = () => window.dispatchEvent(new CustomEvent("fieldbook-sync"));

export interface OfflinePhoto {
  blob: Blob;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

interface OutboxRecord {
  id: string;
  ownerUserId: number;
  kind: "observation" | "action" | "photo" | "status" | "note";
  createdAt: string;
  payload: Record<string, unknown>;
  photos?: OfflinePhoto[];
  entityType?: "observations" | "actions";
  entityId?: number;
  lastError?: string;
}

export interface PendingChange {
  id: string;
  kind: OutboxRecord["kind"];
  createdAt: string;
  lastError?: string;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, mode);
    const request = work(tx.objectStore(OUTBOX));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export const queueObservation = async (payload: Record<string, unknown>, ownerUserId: number, photos: OfflinePhoto[] = []) => {
  const id = String(payload.offlineId ?? crypto.randomUUID());
  await transact("readwrite", (store) => store.put({ id, ownerUserId, kind: "observation", createdAt: new Date().toISOString(), payload, photos } satisfies OutboxRecord));
  notifyQueued();
  requestBackgroundSync();
  return id;
};

export const queueAction = async (payload: Record<string, unknown>, ownerUserId: number) => {
  const id = String(payload.offlineId ?? crypto.randomUUID());
  await transact("readwrite", (store) => store.put({ id, ownerUserId, kind: "action", createdAt: new Date().toISOString(), payload } satisfies OutboxRecord));
  notifyQueued();
  requestBackgroundSync();
  return id;
};

export const queuePhoto = async (entityType: "observations" | "actions", entityId: number, photo: OfflinePhoto, ownerUserId: number) => {
  const id = crypto.randomUUID();
  await transact("readwrite", (store) => store.put({ id, ownerUserId, kind: "photo", createdAt: new Date().toISOString(), payload: {},
    photos: [photo], entityType, entityId } satisfies OutboxRecord));
  notifyQueued();
  requestBackgroundSync();
};

export const queueStatusUpdate = async (
  entityType: "observations" | "actions",
  entityId: number,
  payload: Record<string, unknown>,
  ownerUserId: number,
) => {
  const id = crypto.randomUUID();
  await transact("readwrite", (store) => store.put({ id, ownerUserId, kind: "status", createdAt: new Date().toISOString(),
    payload, entityType, entityId } satisfies OutboxRecord));
  notifyQueued();
  requestBackgroundSync();
};

export const queueNote = async (payload: Record<string, unknown>, ownerUserId: number) => {
  const id = String(payload.offlineId ?? crypto.randomUUID());
  await transact("readwrite", (store) => store.put({ id, ownerUserId, kind: "note", createdAt: new Date().toISOString(),
    payload } satisfies OutboxRecord));
  notifyQueued();
  requestBackgroundSync();
};

export async function pendingCount(): Promise<number> {
  return transact("readonly", (store) => store.count());
}

export async function pendingCountForOtherUser(ownerUserId: number): Promise<number> {
  const records = await transact<OutboxRecord[]>("readonly", (store) => store.getAll());
  return records.filter((record) => record.ownerUserId !== ownerUserId).length;
}

export async function pendingCountForUser(ownerUserId: number): Promise<number> {
  const records = await transact<OutboxRecord[]>("readonly", (store) => store.getAll());
  return records.filter((record) => record.ownerUserId === ownerUserId).length;
}

export async function clearPrivateCache(): Promise<void> {
  if ("caches" in window) await window.caches.delete(PRIVATE_CACHE);
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
}

export async function listPendingChanges(ownerUserId: number): Promise<PendingChange[]> {
  const records = await transact<OutboxRecord[]>("readonly", (store) => store.getAll());
  return records.filter((record) => record.ownerUserId === ownerUserId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, kind, createdAt, lastError }) => ({ id, kind, createdAt, lastError }));
}

export async function discardPendingChange(id: string, ownerUserId: number): Promise<void> {
  const record = await transact<OutboxRecord | undefined>("readonly", (store) => store.get(id));
  if (!record || record.ownerUserId !== ownerUserId) throw new Error("Queued change not found for this account");
  await transact("readwrite", (store) => store.delete(id));
  notifyQueued();
}

export async function uploadPhoto(entityType: "observations" | "actions", entityId: number, photo: OfflinePhoto) {
  const grant = await apiJson<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: photo.originalFilename, size: photo.fileSize, contentType: photo.mimeType }),
  });
  const uploaded = await fetch(grant.uploadURL, { method: "PUT", headers: { "Content-Type": photo.mimeType }, body: photo.blob });
  if (!uploaded.ok) throw new Error("Photo upload failed");
  await apiJson(`/api/${entityType}/${entityId}/images`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageKey: grant.objectPath, originalFilename: photo.originalFilename,
      mimeType: photo.mimeType, fileSize: photo.fileSize, ...(entityType === "observations" ? { imageType: "observation" } : {}) }) });
}

export async function syncOutbox(): Promise<{ synced: number; remaining: number }> {
  if (!navigator.onLine) return { synced: 0, remaining: await pendingCount() };
  const records = await transact<OutboxRecord[]>("readonly", (store) => store.getAll());
  const currentUser = await apiJson<{ id: number }>("/api/auth/me");
  let synced = 0;
  for (const record of records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (record.ownerUserId !== currentUser.id) continue;
    try {
      if (record.kind === "observation") {
        const created = await apiJson<{ id: number }>("/api/observations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
        for (const photo of record.photos ?? []) await uploadPhoto("observations", created.id, photo);
      } else if (record.kind === "action") {
        await apiJson("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
      } else if (record.kind === "status" && record.entityType && record.entityId) {
        await apiJson(`/api/${record.entityType}/${record.entityId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record.payload) });
      } else if (record.kind === "note") {
        await apiJson("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
      } else if (record.entityType && record.entityId && record.photos?.[0]) {
        await uploadPhoto(record.entityType, record.entityId, record.photos[0]);
      }
      await transact("readwrite", (store) => store.delete(record.id));
      synced += 1;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status < 500) {
        record.lastError = error.message;
        await transact("readwrite", (store) => store.put(record));
      }
      break;
    }
  }
  return { synced, remaining: await pendingCount() };
}

async function requestBackgroundSync() {
  const registration = await navigator.serviceWorker?.ready;
  if (registration && "sync" in registration) {
    await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register("fieldbook-outbox").catch(() => undefined);
  }
}

export function initialiseOfflineSync() {
  const run = () => void syncOutbox()
    .then((result) => window.dispatchEvent(new CustomEvent("fieldbook-sync", { detail: result })))
    .catch(() => undefined);
  window.addEventListener("online", run);
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "SYNC_OUTBOX") run();
    if (event.data?.type === "OUTBOX_SYNCED") void pendingCount().then((remaining) => window.dispatchEvent(new CustomEvent("fieldbook-sync", { detail: { synced: event.data.synced, remaining } })));
  });
  if (navigator.onLine) run();
}
