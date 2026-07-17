---
name: Blickling Fieldbook
description: Full-stack field recording PWA for Blickling Estate; phases 1+2 complete, Terrain redesign complete
---

## Status
- Phase 1 (core CRUD): complete
- Phase 2 (map + photos): complete
- Phase 3 (Terrain redesign): complete — every screen rewritten to dark Terrain design
- Phase 4 (PWA offline + service worker): not built
- Phase 5 (CSV/print export, admin UI, audit timeline): not built

## Terrain Design System (now the live app design)
All colour tokens are hardcoded hex (not CSS vars) for reliability:
- bg: #0d1117, surface: #161b22, border: #30363d, borderMid: #21262d
- text: #e6edf3, muted: #8b949e, dim: #484f58
- emerald: #10b981 (primary), urgentRed: #f85149, high: #d29922, blue: #58a6ff
- Fonts: Space Grotesk (headings/numbers), Inter (body), Spline Sans Mono (code)
- Priority left-border pattern: 3px colored border-left on list item cards
- Dark cards: bg #161b22, border 1px solid #30363d, rounded-xl
- Inputs: bg #0d1117, border #30363d, focus-border #10b981

## Architecture
- Auth: express-session + bcryptjs. requireAuth in artifacts/api-server/src/lib/auth.ts
- Route mounting: short paths in route files (e.g. /summary), prefix added in routes/index.ts
- Drizzle: camelCase property names in queries (e.g. actionsTable.dueDate)
- DB push requires interactive TTY — use raw executeSql for new tables
- OpenAPI: new paths before components:, new schemas inside components/schemas:
- Mockup sandbox: https://${REPLIT_DOMAINS}/__mockup/preview/{folder}/{Component}

## DashboardSummary fields (from OpenAPI)
openObservations, urgentObservations, highObservations, overdueActions, actionsDueThisWeek, observationsLast30Days, actionsCompletedLast30Days

## DashboardCharts fields
byCategory, byStatus, actionsByAssignee, observationsOverTime — NO byLocation field

## Seed credentials
admin@blickling.nt / admin123, sarah.jennings@blickling.nt / manager123, alice.frost@blickling.nt / member123

## Image/storage
- Tables: observation_images, action_images (created via raw SQL, not drizzle push)
- Schema files in lib/db/src/schema/; exported from index.ts
- image_type enum: observation/progress/completion
- Storage route uses req.session?.userId (NOT req.isAuthenticated — that's Replit Auth pattern)
