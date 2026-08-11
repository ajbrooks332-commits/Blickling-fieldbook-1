# Blickling Fieldbook

Mobile-first estate management PWA for recording field observations, assigning actions, tracking work, managing photographs and producing reports across Blickling Estate.

## What is included

- Secure one-time administrator setup; no committed accounts or default passwords.
- Administrator, manager and team-member roles enforced by both the API and UI.
- Observation and action workflows with mandatory action assignees, audit history and admin-only soft archiving.
- Private, validated photo storage. JPEG, PNG and WebP uploads are inspected, resized and normalised to WebP.
- Installable PWA with cached private data and maps, plus an account-bound queue for observations, actions, status updates, notes and photos when there is no signal.
- PostgreSQL-backed sessions and automatic additive schema bootstrap/migration on startup.
- Responsive lists, map, dashboard, reports, CSV export and management screens.

## Repository map

| Path | Purpose |
| --- | --- |
| `artifacts/blickling-fieldbook` | React/Vite PWA |
| `artifacts/api-server` | Express API and production static server |
| `lib/db` | Drizzle PostgreSQL schema |
| `lib/api-spec/openapi.yaml` | API contract (source of truth) |
| `lib/api-client-react` | Generated React Query client |
| `lib/api-zod` | Generated API validation schemas |

## Required environment variables

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random value of at least 32 characters; keep permanently |
| `SETUP_SECRET` | Random value of at least 24 characters; needed only for first setup |
| `PRIVATE_OBJECT_DIR` | Replit Object Storage private directory used for photographs |
| `PORT` | Listening port; supplied automatically by Replit Publishing |

`APP_ORIGIN` is optional. If supplied, use the exact public origin (for example `https://example.replit.app`) without a trailing slash. `LOG_LEVEL` and `STATIC_DIR` are optional operational overrides.

## Replit deployment

1. Import or pull this repository into Replit.
2. Provision PostgreSQL and Object Storage.
3. Add `DATABASE_URL`, `SESSION_SECRET`, `SETUP_SECRET` and `PRIVATE_OBJECT_DIR` to the **Publishing/Deployment secrets**, not only the development workspace secrets.
4. Publish as **Autoscale**. The committed `.replit` runs `pnpm run build:deploy` and then `pnpm start`.
5. Open the published URL. The first visit shows the protected setup form.
6. Enter the same `SETUP_SECRET`, create the administrator, then remove `SETUP_SECRET` from the deployment secrets and republish.

Startup creates a fresh schema when necessary and applies additive migrations to an existing database. It never runs the destructive development seed. Back up the production database before deploying any future schema change.

## Development and verification

Use Node.js 24 and pnpm 11.21.0.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm run check
```

Useful commands:

```sh
pnpm run typecheck
pnpm run test
pnpm run build:deploy
pnpm --filter @workspace/api-server run seed
```

The seed is deliberately destructive and development-only. It requires both `NODE_ENV` other than `production` and `ALLOW_DESTRUCTIVE_SEED=true`; it creates reference data but no users or passwords.

The API development server expects `PORT=8080`. The frontend development server defaults to port 5173 and proxies `/api` to port 8080.

## Offline and device security

Authenticated API responses and queued field records are stored on the device so the app can work offline. Users should log out before sharing a device; logout clears the private response cache. Organisation-managed devices should use screen locks and remote-wipe controls.

See [SECURITY.md](SECURITY.md) and [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) for the security model and remediation record.
