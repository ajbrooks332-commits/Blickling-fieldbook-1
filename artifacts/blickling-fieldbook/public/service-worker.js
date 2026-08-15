const SHELL = "fieldbook-shell-__BUILD_ID__";
const PRIVATE = "fieldbook-private-v1";
const TILES = "fieldbook-map-tiles-v1";
const BUILD_ASSETS = [];
const OFFLINE_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", ...BUILD_ASSETS];
const CACHEABLE_API = [/^\/api\/auth\/(me|setup-status)$/, /^\/api\/users\/assignees$/, /^\/api\/categories/, /^\/api\/locations/, /^\/api\/observations/, /^\/api\/actions/, /^\/api\/dashboard/, /^\/api\/storage\/objects\//];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(OFFLINE_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, PRIVATE, TILES].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await trimCache(cache, cacheName === PRIVATE ? 1000 : 200);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function trimCache(cache, maximumEntries) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximumEntries)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(caches.open(TILES).then(async (cache) => (await cache.match(request)) ?? fetch(request).then((response) => {
      if (response.ok || response.type === "opaque") void cache.put(request, response.clone()).then(() => trimCache(cache, 500));
      return response;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (CACHEABLE_API.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request, PRIVATE));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(networkFirst(request, SHELL));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "fieldbook-outbox") event.waitUntil(syncOutboxInWorker());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") event.waitUntil(caches.delete(PRIVATE));
});

function openOutbox() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("blickling-fieldbook", 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("outbox")) request.result.createObjectStore("outbox", { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function outboxOperation(mode, operation) {
  const db = await openOutbox();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("outbox", mode); const request = operation(transaction.objectStore("outbox"));
    let result;
    request.onsuccess = () => { result = request.result; }; request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

async function apiJson(url, init = {}) {
  const headers = new Headers(init.headers); headers.set("X-Requested-With", "BlicklingFieldbook");
  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error || `Queued request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function uploadQueuedPhoto(entityType, entityId, photo) {
  const grant = await apiJson("/api/storage/uploads/request-url", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: photo.originalFilename, size: photo.fileSize, contentType: photo.mimeType }) });
  const uploaded = await fetch(grant.uploadURL, { method: "PUT", headers: { "Content-Type": photo.mimeType }, body: photo.blob });
  if (!uploaded.ok) throw new Error("Queued photo upload failed");
  await apiJson(`/api/${entityType}/${entityId}/images`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageKey: grant.objectPath, originalFilename: photo.originalFilename, mimeType: photo.mimeType,
      fileSize: photo.fileSize, ...(entityType === "observations" ? { imageType: "observation" } : {}) }) });
}

async function syncOutboxInWorker() {
  const records = await outboxOperation("readonly", (store) => store.getAll());
  const currentUser = await apiJson("/api/auth/me");
  let synced = 0;
  for (const record of records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (record.ownerUserId !== currentUser.id) continue;
    if (record.quarantined) continue; // parked until the user fixes/retries/discards it
    try {
      if (record.kind === "observation") {
        const created = await apiJson("/api/observations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
        for (const photo of record.photos || []) await uploadQueuedPhoto("observations", created.id, photo);
      } else if (record.kind === "action") {
        await apiJson("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
      } else if (record.kind === "activity") {
        await apiJson("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
      } else if (record.kind === "status" && record.entityType && record.entityId) {
        await apiJson(`/api/${record.entityType}/${record.entityId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record.payload) });
      } else if (record.kind === "note") {
        await apiJson("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record.payload) });
      } else if (record.entityType && record.entityId && record.photos?.[0]) {
        await uploadQueuedPhoto(record.entityType, record.entityId, record.photos[0]);
      }
      await outboxOperation("readwrite", (store) => store.delete(record.id)); synced += 1;
    } catch (error) {
      if (error?.status && error.status >= 400 && error.status < 500) {
        // Terminal for this item: quarantine and CONTINUE with later work.
        record.lastError = error.message;
        record.quarantined = true;
        await outboxOperation("readwrite", (store) => store.put(record));
        continue;
      }
      break; // network/server failure — stop for now, retry later
    }
  }
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "OUTBOX_SYNCED", synced }));
}
