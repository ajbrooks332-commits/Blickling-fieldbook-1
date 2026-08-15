# Governance procedures and required external actions

Companion to `docs/operations-runbook.md` (backup, restore, rollback, incident
response). This file documents release/access procedures that are safe to adopt
now, and honestly records the external checks that **cannot be completed from
inside this environment**. Nothing listed under "External actions" has been
performed unless explicitly marked done.

## Release procedure

1. All work lands on a feature branch; never commit directly to `main`.
2. Before merge: `pnpm install --frozen-lockfile`, `pnpm run typecheck`,
   `pnpm run test` (disposable database), frontend a11y suite
   (`pnpm --filter @workspace/blickling-fieldbook run test:a11y`), and
   `pnpm run build:deploy`.
3. GitHub Actions must be fully green (not skipped/cancelled) on the branch.
4. Fast-forward merge only; no force pushes to any branch, ever.
5. Republish the deployment from the verified `main` commit, then run
   `./scripts/edge-smoke-test.sh <https-origin>` against the public URL.
6. Migrations are additive and ledgered (checksummed, append-only). If a
   release includes a migration, confirm a fresh backup exists first
   (`scripts/backup.sh`).

## Rollback

See `docs/operations-runbook.md` — redeploy the previous commit (schema is
additive, old code runs on new schema); database restore only when a migration
itself caused the incident.

## Access review (quarterly)

1. Managers open Users and confirm every active account belongs to a current
   team member; deactivate leavers (this revokes their sessions immediately).
2. Confirm the manager/administrator list is still correct and minimal.
3. Check `audit_events` for `auth_failure` clusters and unfamiliar
   `user_created` / `user_updated` events.
4. Record the date and reviewer.

## Lost or stolen phone

1. A manager deactivates the user's account immediately (all sessions revoked).
2. The device's offline lease expires within 8 hours; locally cached data is
   wiped when the lease lapses or the next sign-in fails.
3. Re-enable the account with a new temporary password once the user has a
   trusted device; the user must change it at first login.
4. Note the event in the incident log; unsynced work on the lost device is
   lost — record the gap if the user reports one.

## Dependency inventory / SBOM

`docs/dependency-inventory.json` is generated from the lockfile with
`pnpm licenses list --json --prod` (name, version, licence per production
dependency). Regenerate at each release. No private source is transmitted —
the inventory is derived locally from `pnpm-lock.yaml`. A full CycloneDX/SPDX
SBOM tool is not part of the pinned toolchain; adopting one is listed below as
an optional external action.

## External actions — required, NOT performed

These need the repository owner, the National Trust, or third parties. They are
reported as blockers; no passing test in this repository substitutes for them.

| # | Action | Owner |
|---|--------|-------|
| 1 | Confirm GitHub repository privacy and organisational ownership; enable branch protection on `main` (required checks, no force push). | Repo owner |
| 2 | Review Replit and GitHub data-processing terms and hosting regions against National Trust requirements (UK/EU data residency). | Data owner |
| 3 | DPIA, data classification and retention schedule for observation/personnel data. | Data owner |
| 4 | Independent penetration test of the deployed application. | Third party |
| 5 | Manual WCAG 2.2 AA audit with assistive technology (automated axe checks are necessary but not sufficient). | Third party |
| 6 | Verify Replit database point-in-time recovery in the workspace database pane; until confirmed, rely on `scripts/backup.sh` dumps. | Repo owner |
| 7 | Licensed offline map source for the Blickling estate (see `docs/map-provider.md`) — no offline-licensed provider currently approved. | Data owner |
| 8 | National Trust SSO/MFA/SCIM — intentionally NOT configured; requires approved corporate credentials and requirements. | NT IT |
| 9 | Real iPhone/Android device testing of offline capture and print/PDF output (automated simulation exists; real-device runs remain outstanding). | Estate team |
| 10 | Optional: adopt a CycloneDX SBOM generator in CI. | Repo owner |

## Explicit non-claims

- No DPIA, DPA review, penetration test, restore drill on production, corporate
  approval or accessibility certification has occurred.
- Repository visibility/ownership has not been changed by tooling.
