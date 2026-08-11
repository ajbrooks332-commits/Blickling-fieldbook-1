# Blickling Fieldbook codebase review and remediation record

## Review scope

The repository was reviewed across deployment configuration, startup, database schema, authentication, authorisation, API validation, record workflows, file handling, offline behaviour, frontend routes, accessibility, generated API clients, reporting, tests and operating documentation.

The original deployment could build separate API and frontend artifacts but did not serve the PWA from the production server and did not define Replit deployment build/run commands. It also contained insecure reset/seed paths, placeholder screens and several incomplete or mismatched API/UI workflows. This remediation makes the repository deploy as one production application.

## High-impact corrections

| Area | Problem found | Correction |
| --- | --- | --- |
| Deployment | No usable production build/run contract; API did not serve frontend | Explicit Replit Autoscale commands, deterministic production build and SPA/static serving with cache rules |
| Database | Production relied on schema push and could not bootstrap a fresh database safely | Transactional, additive and idempotent startup schema bootstrap/migrations; runtime aborts on migration failure |
| Initial access | Committed/reset-style credentials and unsafe reset surface | Removed reset endpoints and accounts; secret-protected, concurrency-safe one-time setup |
| Sessions | Weak configuration and stale role/property trust | PostgreSQL sessions, secure cookie policy, 12-hour rolling expiry, per-request active-user reload and session version revocation |
| Request security | Missing browser mutation verification and hardened headers | Exact same-origin/custom-header checks, Helmet CSP, body limits, no-store API responses and redacted logs |
| Permissions | UI and API permissions diverged in several areas | Central role helpers, estate scoping, admin-only account/archive operations and assignee-or-manager action updates |
| Records | Permanent deletion and non-atomic reference allocation | Soft archive with audit events; transactional writes and atomic per-estate/year reference counters |
| Validation | Many routes accepted unbounded or loosely typed payloads | Strict Zod schemas, pagination limits, relation ownership checks, state-transition validation and meaningful errors |
| Actions | Assignee was effectively optional and transitions lacked required reasons | Mandatory active assignee; completion, waiting and cancellation data enforced |
| Uploads | Client metadata was trusted and object access was over-broad | Short-lived one-use grants, byte/type/size inspection, image normalisation and authenticated estate-scoped reads |
| Offline/PWA | Offline fields existed but end-to-end sync was absent | Installable PWA, precached route chunks, account-bound private caching, IndexedDB outbox and background sync for records/statuses/notes/photos |
| Frontend | Missing edit/setup/settings/user/report flows and route guard errors | Implemented screens, role guards, password-change gate, error states, paging/search and accessible controls |
| Reporting | Date/status handling and CSV output were incomplete | Estate-scoped summaries, UK-date handling, guarded date ranges and spreadsheet-formula-safe CSV export |
| Supply chain | No continuous verification | Typecheck, unit tests, fresh-Postgres migration test, production build, service-worker validation, audit step and Dependabot |

## Deliberate product decisions

- One estate is configured by the protected setup flow.
- Every new action requires an active assignee.
- Observations and actions are soft-archived by administrators rather than permanently deleted.
- Team members can update actions assigned to them; managers and administrators can manage estate-wide work.
- Offline storage is intentionally available for field operation. Logging out clears private response caches, but managed-device controls remain important.
- Initial categories and named Blickling locations are created only when the selected estate has none, preserving existing reference data.

## Verification gates

The repository's `pnpm run check` gate performs workspace typechecking, automated tests, JavaScript syntax validation and both production builds. GitHub Actions additionally starts a clean PostgreSQL 16 service to prove the schema bootstrap is idempotent and runs a production dependency audit.

## Remaining operational responsibilities

No code review can replace production operations. Before rollout, the owner should test on the actual Replit URL and target mobile devices, confirm Replit Object Storage CORS/upload behaviour, define backup/restore and retention policy, assign a private vulnerability contact, and decide how long estate records/photos must be retained. These are deployment-owner decisions rather than safe code defaults.
