---
name: Blickling Fieldbook — Phase 1 & 2 completion
description: What was built in Phases 1 and 2, key decisions, and gotchas for future phases.
---

## What is built (Phase 1 + Phase 2 complete)

Full-stack mobile-first PWA for Blickling Estate field staff.

**Backend** (`artifacts/api-server`):
- Express + Drizzle ORM + PostgreSQL
- Session auth with bcryptjs (NOT bcrypt — native build ignored by pnpm; bcryptjs is pure JS)
- Routes: `/api/auth/*`, `/api/users`, `/api/categories`, `/api/locations`, `/api/observations/*`, `/api/actions/*`, `/api/notes`, `/api/dashboard/*`, `/api/reports/*`, `/api/storage/*`, `/api/observations/:id/images`, `/api/actions/:id/images`
- `src/lib/auth.ts` — `requireAuth` and `requireRole` middleware
- `src/lib/references.ts` — generates BLK-YYYY-XXXXX and ACT-YYYY-XXXXX ref numbers
- `src/lib/objectStorage.ts` — GCS-backed object storage via Replit sidecar auth
- `src/routes/storage.ts` — presigned URL upload + object serving (uses `req.session?.userId` not `req.isAuthenticated()`)
- `src/routes/images.ts` — observation_images and action_images CRUD
- `src/seed.ts` — run with `pnpm --filter @workspace/api-server run seed`

**Frontend** (`artifacts/blickling-fieldbook`):
- React + Vite, wouter routing, TanStack Query
- Design: Norfolk landscape palette, Plus Jakarta Sans + DM Serif Display, stone background
- Auth redirect in App.tsx AuthWrapper — MUST use useEffect for navigation, not inline during render
- Bottom nav (mobile): Home, Map, Record (prominent centre), Actions, More drawer
- Sidebar (desktop): full nav
- **Map page**: Leaflet + leaflet.markercluster, centered on Blickling Estate (52.826, 1.284), colored circle markers by priority, filter panel, user location dot
- **Photo upload**: PhotoUpload.tsx — browser-image-compression + presigned URL flow + direct GCS PUT
- **Photo gallery**: PhotoGallery.tsx — responsive grid, lightbox modal
- **ObservationNew**: GPS map preview in step 1, real photo upload in step 4 (stored as pending, uploaded after observation created)
- **ObservationDetail**: Photographs section with PhotoGallery + add photo button

**DB schema** (`lib/db/src/schema/`):
- properties, users, categories, named_locations, observations, actions, notes, audit_events, observation_images, action_images
- `image_type` enum: observation/progress/completion
- Observation statuses: draft/submitted/under_review/action_required/monitoring/resolved/closed/cancelled
- Action statuses: not_started/planned/in_progress/waiting/completed/cancelled

**Image upload flow**:
1. POST /api/storage/uploads/request-url → { uploadURL, objectPath }
2. PUT file bytes directly to GCS presigned URL
3. POST /api/observations/:id/images with { storageKey: objectPath, originalFilename, mimeType, fileSize, caption, imageType }
4. Serve: GET /api/storage/objects/{path} (storageKey="/objects/abc" → fetch("/api/storage/objects/abc"))

**Object storage**: Replit App Storage (GCS-backed). Bucket ID in DEFAULT_OBJECT_STORAGE_BUCKET_ID env var.

**Seed credentials**:
- admin@blickling.nt / admin123
- sarah.jennings@blickling.nt / manager123
- alice.frost@blickling.nt / member123
- tom.hadley@blickling.nt / member123

## Key gotchas

**Drizzle camelCase**: Drizzle `sql` template literals must use camelCase column property names (e.g. `actionsTable.dueDate`), NOT snake_case.

**Observation vs Action statuses**: `"in_progress"` is ONLY valid for actions, not observations. Observations use `"under_review"` or `"action_required"` instead.

**Route double-prefix bug**: All route files define their own path prefix AND index.ts mounts them with the same prefix — causing double prefixes. Fixed in Phase 1. Do NOT add path prefix back inside route files that are mounted with a prefix.

**Trust proxy**: Express must have `app.set('trust proxy', 1)` for secure cookies to work behind Replit's HTTPS proxy in production.

**DB push TTY**: `pnpm --filter @workspace/db run push` requires interactive TTY. For new tables in CI/scripts, use raw SQL via executeSql callback instead.

**Storage route auth**: The copied storage.ts template uses `req.isAuthenticated()` (Replit Auth pattern). We use express-session, so it checks `req.session?.userId` instead.

**Leaflet in Vite**: Must delete `(L.Icon.Default.prototype as any)._getIconUrl` and call `L.Icon.Default.mergeOptions(...)` with explicit icon paths, or markers won't render. Use direct `L.map()` (not react-leaflet MapContainer) when using markercluster to avoid conflicts.

**OpenAPI YAML structure**: New paths must go inside the `paths:` section (before `components:`), new schemas inside `components/schemas:`. Appending to end of file breaks the structure — use targeted inserts.

## Phase 3 scope (not built)
- PWA installation manifest + service worker
- IndexedDB storage for offline observations
- Offline observation creation + sync queue
- Retry handling, duplicate prevention, sync status page

## Phase 4 scope (not built)
- CSV export, printable HTML report
- Full user/category/location admin UI improvements
- Audit history timeline improvements
