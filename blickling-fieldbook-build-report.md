# Blickling Fieldbook — App Build Report
*Prepared for external review. This document describes the current state of a custom Progressive Web App (PWA) built for Blickling Estate (National Trust) staff to record, manage, and report on field observations and maintenance actions.*

---

## 1. Project Overview

**Name:** Blickling Fieldbook  
**Client:** Blickling Estate, National Trust  
**Purpose:** A mobile-first field operations tool for estate staff to log observations (faults, hazards, conditions), raise and manage actions (maintenance tasks), track progress, and generate management reports.  
**Deployment:** Web-based PWA, hosted on Replit. Accessible from mobile browsers on estate. No app store required.

---

## 2. Technical Architecture

### Monorepo Structure
The project is a pnpm monorepo with the following packages:

| Package | Purpose |
|---|---|
| `artifacts/blickling-fieldbook` | React frontend (Vite, PWA) |
| `artifacts/api-server` | Express REST API (Node.js) |
| `lib/db` | Shared database schema (Drizzle ORM + PostgreSQL) |
| `lib/api-zod` | Shared Zod validation schemas for request/response |
| `lib/api-client-react` | Auto-generated TanStack Query React hooks from the API schema |

### Frontend Stack
- **Framework:** React 18 with TypeScript
- **Build tool:** Vite
- **Routing:** Wouter (lightweight, file-path routing)
- **Server state:** TanStack Query (React Query) — all API calls use generated hooks
- **Styling:** Tailwind CSS utility classes + inline style tokens (custom dark design system)
- **Maps:** Leaflet / React-Leaflet (interactive observation mapping, pin-drop)
- **Photo uploads:** Uppy (drag-and-drop, mobile camera)
- **Icons:** Lucide React
- **UI primitives:** Radix UI (dialogs, tooltips, dropdowns)
- **Design system:** "Terrain Dark" — custom dark theme with `#0d1117` background, `#10b981` emerald primary, Space Grotesk headings, Inter body text

### Backend Stack
- **Framework:** Express.js (Node.js/TypeScript)
- **ORM:** Drizzle ORM (type-safe, no code generation required)
- **Database:** PostgreSQL (Replit-managed, separate dev and production instances)
- **Auth:** `express-session` + `connect-pg-simple` (session stored in Postgres), `bcryptjs` for password hashing
- **Logging:** Pino (structured JSON logging)
- **Validation:** Zod (shared with frontend via `lib/api-zod`)
- **File storage:** Replit Object Storage (S3-compatible) for observation photos

---

## 3. Database Schema

All tables use Drizzle ORM with camelCase property names mapped to snake_case columns.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| email | text | unique |
| password_hash | text | bcrypt |
| role | enum | `administrator`, `manager`, `team_member` |
| active | boolean | soft disable accounts |
| created_at / updated_at | timestamp | |

### `observations`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| reference_number | text | auto-generated, e.g. `OBS-0001` |
| title | text | required |
| description | text | |
| priority | enum | `urgent`, `high`, `normal`, `low` |
| status | enum | `submitted`, `under_review`, `action_required`, `monitoring`, `resolved`, `closed`, `cancelled` |
| category_id | FK → categories | |
| named_location_id | FK → named_locations | optional |
| reported_by_user_id | FK → users | |
| latitude / longitude | numeric | GPS or pin-drop coordinates |
| gps_accuracy_metres | numeric | from device GPS |
| safety_issue | boolean | |
| public_access_affected | boolean | |
| machinery_required | boolean | |
| follow_up_required | boolean | |
| created_offline | boolean | future offline sync flag |
| offline_id | text | future offline sync key |
| observed_at | timestamp | when the issue was seen |
| resolved_at / closed_at | timestamp | |
| created_at / updated_at | timestamp | |

### `actions`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| reference_number | text | auto-generated, e.g. `ACT-0001` |
| observation_id | FK → observations | optional link |
| title | text | required |
| description | text | |
| priority | enum | `urgent`, `high`, `normal`, `low` |
| status | enum | `not_started`, `planned`, `in_progress`, `waiting`, `completed`, `cancelled` |
| assigned_to_user_id | FK → users | |
| created_by_user_id | FK → users | |
| due_date | timestamp | |
| estimated_minutes | integer | |
| equipment_required | boolean | |
| contractor_required | boolean | |
| completed_at | timestamp | |
| completion_note | text | |
| waiting_reason / cancellation_reason | text | |
| created_at / updated_at | timestamp | |

### `categories`
User-defined observation categories with colour coding and optional icon (e.g. "Infrastructure", "Ecology", "Public Safety").

### `named_locations`
Predefined estate areas (e.g. "Walled Garden", "North Lake") used to tag observations without requiring GPS.

### `notes`
Free-text notes attached to either an observation or an action, with author and timestamp.

### `audit_events`
Immutable log of status changes on observations and actions (who changed what, from/to which status, when).

### `observation_images`
Metadata for uploaded photos linked to observations (storage key, filename, MIME type, image type).

### `sessions`
PostgreSQL-backed session store for `express-session`.

---

## 4. API Surface

All routes are prefixed `/api/`. Auth is session-based; all routes except `/auth/login` require authentication.

| Method | Route | Description |
|---|---|---|
| POST | `/auth/login` | Username + password login |
| POST | `/auth/logout` | Destroy session |
| GET | `/auth/me` | Current user info + role |
| GET | `/dashboard/summary` | Metric counts for dashboard tiles |
| GET | `/dashboard/charts` | Time-series data for charts |
| GET/POST | `/observations` | List (filtered/paginated) + create |
| GET | `/observations/map` | Observations with coordinates for map |
| GET/PATCH/DELETE | `/observations/:id` | Detail, edit, delete |
| PATCH | `/observations/:id/status` | Status workflow transition |
| GET/POST | `/observations/:id/images` | Photo gallery for an observation |
| DELETE | `/observations/:id/images/:imageId` | Remove a photo |
| GET/POST | `/actions` | List all actions (filtered) + create |
| GET | `/actions/my` | Actions assigned to the current user |
| GET/PATCH | `/actions/:id` | Detail + edit |
| PATCH | `/actions/:id/status` | Status workflow transition |
| DELETE | `/actions/:id` | Admin-only permanent delete |
| GET/POST | `/notes` | Create notes on observations/actions |
| GET/POST/PATCH/DELETE | `/users` | User management (admin) |
| GET/POST/PATCH/DELETE | `/categories` | Category management (admin) |
| GET/POST/PATCH/DELETE | `/locations` | Named location management (admin) |
| GET | `/reports` | Report data aggregation |
| POST | `/storage/upload-url` | Pre-signed URL for photo upload |

---

## 5. Frontend Pages & Features

### Navigation
- **Mobile:** Bottom bar with Home, Map, raised centre Record button, Actions, More (drawer for management)
- **Desktop:** Persistent sidebar split into "Work" (Dashboard, All Actions, My Actions, Observations, Map) and "Management" (Reports, Users, Categories, Locations, Settings)
- **Role-based:** Management section only visible to `administrator` or `manager` roles

### Pages Built

#### Dashboard (`/`)
- Summary metric tiles: Open Observations, Urgent, High Priority, Overdue Actions, Due This Week, Recorded Last 30 Days, Completed Last 30 Days
- All tiles are tappable and navigate to a filtered list view
- Charts: weekly observation trend, action status breakdown

#### Observation List (`/observations`)
- Paginated list with search, status filter, priority filter
- URL-based filters (from dashboard tile navigation)
- Dismissible filter chips showing active filters

#### Record New Observation (`/observations/new`)
- Multi-step form: Location → Details → Flags
- **Location step:** three modes:
  - GPS (device location with accuracy indicator)
  - Drop a Pin (interactive Leaflet map centred on Blickling Estate at 52.8406°N, 1.2977°E, draggable marker)
  - Named Area (dropdown of predefined estate locations)
- **Details step:** title, category, priority, observed date/time, description
- **Flags step:** safety issue, public access affected, machinery required, follow-up required

#### Observation Detail (`/observations/:id`)
- Full record with priority, status, location, metadata
- Status workflow panel (change status with audit trail)
- Linked actions section (shows all actions raised for this observation)
- "Action Required" status badge is tappable — navigates directly to the linked action
- Photo gallery with upload capability
- Notes thread
- Audit history timeline

#### Action List (`/actions`)
- Shows **all** actions across the estate (not just current user's)
- Filters: status, priority, search, overdue flag
- Each card shows: reference, priority, status, title, assignee, due date, overdue indicator

#### My Actions (`/actions/my`)
- Filtered to actions assigned to the logged-in user

#### Action Detail (`/actions/:id`)
- Status workflow (Not Started → Planned → In Progress → Waiting → Completed/Cancelled)
- Completion notes, waiting reasons, cancellation reasons captured on transition
- Notes thread
- Audit history
- **Admin-only Delete button** — red button in header, confirmation dialog showing reference + title before permanent deletion (removes action, its notes, and audit history)

#### Map View (`/map`)
- All geotagged observations plotted on Leaflet map
- Filterable by status, priority, category, location, safety flag
- Tap marker to view observation summary

#### Reports (`/reports`)
- Management reporting views (observation and action aggregations)

#### Admin Pages
- **Users** (`/users`): create, edit, deactivate users; assign roles
- **Categories** (`/categories`): manage observation category list with colours
- **Locations** (`/locations`): manage named estate areas

---

## 6. Security & Access Control

- Passwords hashed with bcrypt (cost factor 12)
- Sessions stored server-side in PostgreSQL (not client-side JWT)
- Secure, HttpOnly session cookies in production
- Role-based access: three roles (`administrator`, `manager`, `team_member`)
- Backend `requireRole()` middleware enforces admin-only endpoints (e.g. DELETE action, user management)
- Admin-only UI controls are hidden on the frontend but the backend enforces the restriction independently

---

## 7. Design System — "Terrain Dark"

A custom dark theme inspired by estate/fieldwork aesthetics:

| Token | Value |
|---|---|
| Background | `#0d1117` (near-black) |
| Surface (cards) | `#161b22` |
| Border | `#30363d` |
| Primary (emerald) | `#10b981` |
| Text | `#e6edf3` |
| Muted text | `#8b949e` |
| Urgent/error | `#f85149` (red) |
| High priority | `#d29922` (amber) |
| Normal priority | `#58a6ff` (blue) |
| Heading font | Space Grotesk (Google Fonts) |
| Body font | Inter (Google Fonts) |

Priority and status are consistently colour-coded throughout (list cards, detail badges, filter chips, audit timeline).

---

## 8. What Is Built vs. What Is Planned

### ✅ Complete (Phase 1 & 2)
- Full observation CRUD with GPS/pin/named-area location
- Full action CRUD with observation linking
- Status workflows with audit trails for both observations and actions
- Photo upload and gallery
- Interactive map view
- Dashboard with live metrics
- Role-based access (UI + API)
- Admin: user, category, location management
- Notes on observations and actions
- Admin: delete incorrectly entered actions
- Terrain Dark design system throughout

### 🔲 Not Yet Built (Planned)
- **Phase 3 — Offline PWA:** Service worker, PWA manifest, IndexedDB local storage, sync queue for observations created without connectivity
- **Phase 4 — Export & Admin:** CSV export, print-ready report views, full audit history browser, bulk operations

---

## 9. Known Limitations & Technical Debt

1. **Existing action link bug (production):** An action may have been saved with `observation_id = null` due to a now-fixed bug where `window.location.search` was read before the Wouter router had updated it. The fix (using `useSearch()`) is deployed. That specific action may need to be re-created.

2. **No offline support yet:** The `created_offline` and `offline_id` fields exist in the schema but the service worker and sync queue have not been implemented. The app requires an internet connection.

3. **No push notifications:** No mechanism currently exists to alert assignees when an action is assigned to them or when a due date is approaching.

4. **Single property:** The schema includes a `property_id` field on observations and actions (for multi-estate use), but it is not actively used. All records implicitly belong to Blickling Estate.

5. **Reports page is basic:** The reporting route returns data but the frontend reporting UI is not as fully developed as the core observation/action flows.

6. **No CSV/print export:** Management reports cannot yet be exported.

---

## 10. Suggested Questions for ChatGPT Review

You may want to ask ChatGPT to focus on any of the following:

- **UX & workflow:** Is the observation recording flow appropriate for field staff using mobile devices in outdoor conditions?
- **Data model:** Are there any gaps in the schema that would cause problems at scale or for compliance/audit purposes?
- **Security:** Are there any obvious vulnerabilities in the session-based auth approach or the role enforcement model?
- **Offline strategy:** What is the recommended approach for implementing IndexedDB-based offline creation with a background sync queue?
- **Performance:** Given the single-page architecture and TanStack Query caching, are there any concerns about performance on low-spec mobile devices?
- **Reporting:** What reporting features would be most valuable for estate/land management operations?
- **Missing features:** What features are typically expected in a field operations or asset management tool that are absent here?
