---
name: Blickling Fieldbook — Phase 1 completion
description: What was built in Phase 1 and key decisions for future phases.
---

## What is built (Phase 1 complete)

Full-stack mobile-first PWA for Blickling Estate field staff.

**Backend** (`artifacts/api-server`):
- Express + Drizzle ORM + PostgreSQL
- Session auth with bcryptjs (NOT bcrypt — native build ignored by pnpm; bcryptjs is pure JS)
- Routes: `/api/auth/*`, `/api/users`, `/api/categories`, `/api/locations`, `/api/observations/*`, `/api/actions/*`, `/api/notes`, `/api/dashboard/*`, `/api/reports/*`
- `src/lib/auth.ts` — `requireAuth` and `requireRole` middleware
- `src/lib/references.ts` — generates BLK-YYYY-XXXXX and ACT-YYYY-XXXXX ref numbers
- `src/seed.ts` — run with `pnpm --filter @workspace/api-server run seed`

**Frontend** (`artifacts/blickling-fieldbook`):
- React + Vite, wouter routing, TanStack Query
- Design: Norfolk landscape palette, Plus Jakarta Sans + DM Serif Display, stone background
- Auth redirect in App.tsx AuthWrapper — MUST use useEffect for navigation, not inline during render (fixed React render-setState warning)
- Bottom nav (mobile): Home, Map, Record (prominent centre), Actions, More drawer
- Sidebar (desktop): full nav

**DB schema** (`lib/db/src/schema/`):
- properties, users (administrator/manager/team_member), categories, named_locations, observations, actions, notes, audit_events
- Observation statuses: draft/submitted/under_review/action_required/monitoring/resolved/closed/cancelled
- Action statuses: not_started/planned/in_progress/waiting/completed/cancelled

**Seed credentials**:
- admin@blickling.nt / admin123
- sarah.jennings@blickling.nt / manager123
- alice.frost@blickling.nt / member123
- tom.hadley@blickling.nt / member123

## Key gotchas

**Why:** Drizzle `sql` template literals must use camelCase column property names (e.g. `actionsTable.dueDate`), NOT snake_case (`actionsTable.due_date`). The TS type system catches these but only at typecheck time.

**Observation vs Action statuses:** `"in_progress"` is ONLY valid for actions, not observations. Observations use `"under_review"` or `"action_required"` instead.

## Phase 2 scope (not built)
- Map view (Leaflet + OpenStreetMap) — `/map` route shows "coming soon" placeholder
- Photo upload (object storage)
- Offline support (IndexedDB + PWA service worker)
