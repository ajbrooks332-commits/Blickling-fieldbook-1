# Replit Power Mode implementation instructions — Blickling Fieldbook

You are working on the current codebase for the production application **Blickling Fieldbook**, connected to:

- GitHub repository: `ajbrooks332-commits/Blickling-fieldbook-1`
- Production application: `https://blickling-fieldbook.replit.app/`
- Repository root: the directory containing both `.git` and the root `package.json`

## Mission

Safely harden and correct the **existing working application**. Preserve its current workflows, appearance, records, users and database. Implement the approved reliability, offline, reporting, security and quality work below without redesigning working functionality.

This is an existing application with live data. Treat avoiding regressions and data loss as more important than speed. Do not claim that the application is error-free; make the identified faults correct and make regressions detectable through tests.

## Absolute scope boundary

Implement the approved work in this instruction only.

**Do not implement Phase 4 or any of the following:**

- a new estate/place/asset hierarchy or asset register;
- conditional specialist templates;
- EMP, programme, funding, output, cost-centre or cost-management dimensions;
- Power BI, GIS-grade APIs or new management dashboards;
- specialist tree-safety, deer/firearms, sensitive-species, tenant, donor, incident or security modules.

Do not add these features incidentally to the database, UI, exports or APIs. Do not use an older review document to expand this scope.

The application remains a **Blickling-only personal productivity tool**. Do not convert it into a multi-estate platform. Do not represent it as an approved National Trust corporate system.

## Confirmed business rules

1. Activities must preserve both elapsed duration and person-hours.
2. A two-hour activity with four **selected staff members** equals `2 elapsed hours` and `8 staff person-hours`.
3. The reporter is not automatically a participant. Count the reporter only when deliberately selected.
4. If no participant is selected, require an explicit choice between:
   - elapsed-time-only record;
   - contractor work with hours unknown; or
   - other labour with hours unknown.
   Never silently treat missing labour as zero person-hours.
5. Keep staff, volunteer and contractor contribution distinguishable. Allow contractor hours to be recorded as unknown.
6. The app is used on personal phones protected by PIN/biometric lock.
7. Tenant personal information, incident details, security information, exact sensitive-species locations, tree-risk evidence and deer/firearms information are out of scope. Add concise entry-point guidance warning users not to enter these data types; do not transmit free text to a third-party classifier.
8. Field operation must work for at least six hours without internet after a successful preload.
9. The whole active Blickling structured dataset must be available offline: active reference data, all non-archived observations, all non-archived tasks/actions, activities, participants, notes, named locations and the data required to display them.
10. Store compressed thumbnails offline. Do not automatically download every full-resolution historical photograph. Full-resolution images for current/open records may be deliberately marked for offline availability.
11. Excel `.xlsx` is the required analytical export format.
12. Open tasks must have a meeting-ready PDF/print export.
13. All user-visible calendar-day logic uses `Europe/London`, including BST.

## Mandatory safety procedure

Complete these steps before changing code:

1. Confirm the remote is exactly `ajbrooks332-commits/Blickling-fieldbook-1` and identify the current branch and commit SHA.
2. Run `git fetch origin` and compare local `main` with `origin/main`.
3. If the working tree contains uncommitted tracked changes or untracked files that appear user-authored, **stop and report them**. Do not discard, overwrite, reset, clean or stash them without permission. Obvious dependency/build caches are not user work: identify them safely, keep them uncommitted and add an appropriate ignore rule if needed.
4. Fast-forward local `main` to `origin/main` only. Never force-push, reset published history or silently resolve divergent history.
5. Record the pre-change commit SHA as `PRE_CHANGE_HEAD` in the final report.
6. Create and work on a branch named `agent/fieldbook-reliability-hardening`. If it already exists, create a timestamped variant rather than overwriting it.
7. Inspect the latest source before applying any recommendation. File names and line numbers may have changed. If a listed defect is already correctly fixed, verify it with a regression test and do not rewrite it unnecessarily.
8. Install and use the single pnpm version declared by the root `packageManager`. Do not introduce npm or Yarn lockfiles.
9. Run the current baseline checks and record their exact results before editing:
   - frozen-lockfile install;
   - typecheck;
   - tests;
   - service-worker syntax check;
   - deployment build;
   - production dependency audit at high severity.
10. Do not run a development seed against production. Do not delete, truncate, rename or recreate production tables. Do not reset users, setup state, sessions, observations, tasks, activities, locations, notes or photographs.
11. Database changes must be additive, transactional, repeatable and backwards-compatible. Backfill existing rows deterministically. A migration must never depend on seed data or erase live records.
12. Do not change or expose secret values. Do not print secrets into logs, commits, reports or terminal output.

If a proposed change could lose production data, invalidate existing logins, require an unapproved map licence, require National Trust corporate credentials, or materially alter a confirmed business rule, stop that item and report the blocker instead of guessing. Continue with independent safe items.

## Implementation sequence

Work in the following checkpoints. After every checkpoint, run the relevant focused tests plus typecheck. Commit each verified checkpoint separately so it can be reverted without losing the others. Do not bundle the entire change into one untested edit.

### Checkpoint 1 — restore the release quality gate

1. Resolve the pnpm conflict between the root `packageManager` and `.github/workflows/ci.yml`. Use the root pinned version everywhere.
2. Ensure CI performs, in this order:
   - frozen-lockfile install;
   - typecheck;
   - unit and integration tests with PostgreSQL;
   - service-worker syntax validation;
   - production deployment build;
   - production dependency audit failing on high or critical findings.
3. Pin third-party GitHub Actions to immutable commit SHAs, with a comment showing the human-readable release tag.
4. Keep minimal workflow permissions and add concurrency cancellation for superseded runs where safe.
5. Add tests before or alongside every correction below. CI must not be weakened, bypassed or made green by skipping tests.

Acceptance: a fresh checkout can run the same verification commands as CI, and the GitHub branch check reaches every validation step.

### Checkpoint 2 — correct existing functional defects

Implement and test all of the following while preserving existing API compatibility where practical:

#### Activities and labour reporting

- Store/display elapsed hours separately from calculated person-hours.
- Calculate staff person-hours from elapsed duration multiplied by selected staff only.
- Keep volunteer and contractor labour separate; support unknown contractor hours without converting them to zero.
- Do not automatically add the reporter to participants.
- Make labels explicit: `Elapsed hours`, `Staff person-hours`, `Volunteer person-hours`, `Contractor person-hours` and `Hours status` as applicable. Do not label elapsed duration as `Total hours`.
- Correct existing reports/aggregations without destroying the original elapsed duration or participant history.
- Add migration/backfill handling for old activity rows and tests for one, multiple, zero and mixed participant cases.

#### Task/action dates and lists

- Separate completed and cancelled records, or label their combined bucket `Closed`; never call cancelled tasks completed.
- Clear or disable the overdue-only predicate when viewing closed records.
- Determine overdue status by the `Europe/London` calendar date, not the current timestamp. A task due today is not overdue today.
- Reject impossible dates such as `2026-02-31` at both API and UI boundaries.
- Keep current filters, pagination and mobile interaction working.

#### Workflow correctness

- Do not silently perform the invalid `draft -> action_required` observation transition when creating a task.
- Either require/perform a valid explicit transition first or leave the draft unchanged with clear feedback, consistently with the declared workflow.
- Add workflow regression tests for every status from which a task may be created.

#### Map correctness

- For a task with its own named location, plot its own location coordinates first.
- Fall back to linked-observation GPS or linked-observation named-location coordinates only when the task has no usable location.
- Display observations that have named-location coordinates even when direct observation GPS is absent.
- Reject inactive locations consistently for observations, tasks and activities.
- Make task and observation filters explicit. Do not show unrelated open tasks when an observation-only status filter such as `Closed` is selected while claiming the whole map is filtered.
- Fetch task and observation layers independently so one failed request does not erase the other; show partial-result status and data age.
- Add precedence/filter/error-isolation regression tests.

#### Reporting semantics

- Use field `observedAt` for observation/event-period reporting.
- Retain and export `createdAt`, device-created time, server-received time and `syncedAt` where available for process analysis.
- Clearly distinguish current-backlog snapshot measures from events occurring within the selected reporting period.
- Remove the artificial 366-day restriction where it prevents legitimate historical export, while retaining bounded pagination and safe query limits.
- Add a concise data dictionary defining each exported measure.

### Checkpoint 3 — dependable offline-first operation

Do not rely on opportunistic service-worker response caching as the offline database.

1. Implement an account-partitioned, versioned IndexedDB structured-data store containing the confirmed whole active estate dataset.
2. Add a deliberate preload/sync process. Display `Ready for offline use` only after all required structured datasets complete successfully. Show last successful sync, record counts, approximate local storage usage and data age.
3. Request persistent browser storage where supported. Detect quota pressure and provide a useful warning/recovery path.
4. Implement sync cursor/change tracking, tombstones for deletions/archives and optimistic record versions. Automatically merge only non-conflicting changes; show genuine conflicts for user resolution rather than silently overwriting them.
5. Preserve field-event, device-created, server-received and sync timestamps separately.
6. Use stable client UUID/idempotency keys for every offline mutation.
7. Extend the outbox so users can create and later sync, without internet:
   - observations;
   - tasks/actions;
   - activities and their participant selections/hours status;
   - notes;
   - status changes;
   - photographs.
8. Give every queued photograph its own stable UUID and a server-side uniqueness guarantee. Save progress per photo so retrying after a partial failure never duplicates an already-attached image.
9. Queue processing must continue past a permanently invalid item. Quarantine a terminal 4xx item with a clear fix/retry/discard UI; do not let it block later valid work.
10. Show pending, syncing, failed and conflict states per record, plus an overall queue count. Provide manual retry alongside automatic reconnect retry.
11. Ensure a browser/app restart in airplane mode retains both the downloaded dataset and unsynced work.
12. Add an eight-hour offline authorisation lease beginning at the last successful online authorisation. After expiry, retain queued unsynced work safely but block viewing cached estate data or creating more records until online reauthentication. Do not erase unsynced work merely because the lease expires.
13. Namespace all local stores/caches by account and estate. Successful logout, account change and the `Clear offline data from this phone` control must remove that account's cached dataset and images without deleting server records. Protect the user from accidentally clearing unsynced work by requiring a clear warning and explicit confirmation.
14. Add concise BYOD and data-scope guidance in Settings/help: use a PIN/biometric lock, keep the phone updated, do not share accounts, report a lost phone, and do not record the excluded sensitive information.
15. Update service-worker cache versioning safely. Remove stale caches only after the new application shell activates successfully. Do not aggressively cache HTML or the service worker itself, and ensure users can receive a new deployment instead of being trapped on old assets.

#### Offline photographs

- Store compressed thumbnails for structured records in the standard preload.
- Do not fetch every full-resolution historic image.
- Permit full-resolution images for current/open records to be explicitly made available offline.
- Preserve the existing secure authenticated image-access and normalisation controls.

#### Offline map constraint

- Do **not** bulk-download or prefetch `tile.openstreetmap.org` tiles; this violates the standard tile service policy.
- Keep ordinary online map use and normal viewed-tile caching working.
- If an approved offline-licensed Blickling vector/MBTiles source already exists in the project, integrate it and test it.
- If no approved source exists, add a clean offline fallback showing cached records in list form and a clear `Offline map not downloaded` message. Isolate the map provider behind a documented interface and report the map-data licence/source as an external blocker. Do not fabricate a licence or silently scrape a provider.

Acceptance: after one successful preload, airplane mode must allow viewing the whole active structured dataset and creating every listed record type for at least six hours. Killing/reopening the PWA must not lose data. Reconnection must create each server record/photo exactly once.

### Checkpoint 4 — archives and requested outputs

#### Archive and recovery

- Add manager-visible lists for archived observations and actions with restore controls.
- Preserve audit history and references when restoring.
- Make image deletion recoverable/transactionally safe: do not delete object bytes before the database/audit state is committed. Use a reversible pending-delete/outbox approach or equivalent safe sequence.
- Do not permanently purge records or images in this task.

#### Excel export

Add a manager-only `.xlsx` export with stable column names and real Excel date/time values. Use one row per underlying record and no merged cells in raw-data sheets. Include:

1. `Open Tasks`
2. `All Tasks`
3. `Observations`
4. `Activities`
5. `Activity Participants`
6. `Locations`
7. `Lookup Values`
8. `Data Dictionary`

Export existing operational fields, stable IDs/references, elapsed hours, separate person-hours/labour types, hours status, observed/created/synced timestamps and archived state. Neutralise formula injection in every user-authored text cell. Do not add Phase 4 asset, programme, funding, output or cost fields merely for the export.

#### Open-task meeting PDF/print pack

Add `Export open tasks for meeting` to the Actions page. It must default to all open tasks and respect currently selected task filters. Completed and cancelled tasks must never appear.

Produce an A4 landscape, print-optimised report with:

- title, generation date/time and applied filters;
- counts for urgent, high, overdue, due this week and unassigned;
- ordering: overdue first, then urgent/high/normal/low, then due date;
- task reference, title, location, assignee, priority, status and due date;
- linked observation reference and a short description/latest relevant note;
- blank `Meeting decision / update` space;
- page numbers and generation timestamp.

Prefer reliable print-optimised HTML with one `Print / Save as PDF` action using the device's native print/PDF support. Do not add a heavyweight PDF engine unless native output cannot meet the acceptance criteria. Test Android/Chrome and desktop print layout, page breaks and filter accuracy.

### Checkpoint 5 — application security, integrity and operational resilience

1. Keep the existing bcrypt/session/same-origin/role/estate-scoping/upload protections unless a tested correction is necessary.
2. Make `APP_ORIGIN` mandatory in production and fail startup with a clear non-secret error when absent or invalid. Do not use a production host-derived fallback.
3. Ensure HTML and static assets receive appropriate production headers at the actual public edge: CSP suitable for the app/map, `nosniff`, anti-framing, Referrer Policy and Permissions Policy. Add an external deployment smoke test because code-level Helmet configuration alone is insufficient. Do not break the approved map provider with an incompatible policy.
4. Add complete audit events for activity creation/update/archive/restore, activity-type and location changes, authentication failures, user/role/session changes and important manager actions. Never log passwords, session values, setup secrets or image bytes.
5. Restrict creation/reactivation of canonical activity types and named locations to managers. Preserve field convenience through a proposal flow if non-manager quick-add currently exists. Never silently reactivate archived reference data. Keep alias/merge work minimal and do not build the excluded Phase 4 taxonomy system.
6. Add configured PostgreSQL pool maximum, connection timeout, statement timeout, idle timeout and application name using conservative environment-configurable defaults.
7. Split liveness from readiness. Liveness confirms the process; readiness safely checks required database access and any essential storage dependency without leaking infrastructure details.
8. Replace the growing unversioned startup migration list with a migration ledger/checksum mechanism suitable for the existing database. Preserve all live data and make concurrent startup safe. Add migration tests starting from both an empty database and the pre-change schema/data fixture.
9. Repair the development seed ordering and activity-table coverage. Add a test proving it completes on a disposable database containing activity references. Ensure seed execution is impossible in production without an explicit, separate safeguard.
10. Add optimistic version checks to mutable records and clear `409 conflict` responses/UI where concurrent edits cannot safely merge.
11. Provide controlled session revocation and recovery procedures without weakening the existing password policy. Do not replace working local authentication with fake or unconfigured corporate SSO.
12. Add backup/restore scripts and a concise operator runbook defining backup verification, restore rehearsal, rollback, incident response and recovery objectives. If Replit database backups or point-in-time recovery cannot be verified from the environment, report that honestly as an external action; do not claim it passed.
13. Add structured application/security logging and useful error/sync/readiness alerts without exposing record content or secrets unnecessarily.
14. Correct visible colour contrast, focus-visible styling and touch targets. Add automated axe/Playwright coverage for key pages plus keyboard, zoom and mobile viewport tests. Preserve the current design rather than visually redesigning the app.

### Phase 3 external/conditional controls

Implement repository documentation and code hooks that are safe now, but do not fabricate external assurance:

- Document release, rollback, access review, lost-phone response, backup/restore and incident procedures.
- Generate a dependency inventory/SBOM if the existing toolchain supports it without transmitting private source.
- Record the required external checks for repository privacy/ownership, branch protection, Replit/GitHub data-processing and region assurance, DPIA/data classification/retention, independent penetration testing and manual WCAG 2.2 AA testing.
- Do not change repository visibility/ownership automatically.
- Do not configure National Trust SSO, MFA or SCIM without actual approved credentials and requirements.
- Do not claim a DPIA, DPA review, penetration test, restore drill, corporate approval or accessibility certification has occurred when it has not.

These external items may remain clearly reported blockers. Their absence must not be hidden by a passing unit test.

## Mandatory automated regression coverage

At minimum, add tests for:

- setup/login/logout, role enforcement, estate scoping and session revocation;
- origin/CSRF controls and production `APP_ORIGIN` validation;
- activity elapsed/person-hour rules, including reporter not selected, mixed participant types and unknown contractor hours;
- every offline mutation type, app restart, retry, duplicate retry, partial-photo failure and terminal 4xx queue isolation;
- offline account separation, eight-hour lease expiry, local wipe and unsynced-work protection;
- task-location coordinate precedence and named-location observation fallback;
- independent map filters and partial layer failure;
- valid/invalid dates and BST/calendar-day overdue behaviour;
- observation workflow transitions when creating tasks;
- reporting by `observedAt` versus process timestamps;
- archive/list/restore and audit events;
- Excel sheet names, columns, date cell types, row counts, formula-injection defence and permissions;
- meeting report filtering, ordering, exclusion of completed/cancelled tasks and print layout;
- migration from the pre-change schema with representative existing data;
- readiness failure when the database/storage dependency is unavailable;
- accessibility smoke checks for login, observations, actions, activities, map and reports.

Use deterministic fixtures and a disposable test database. Never point automated tests at production.

## Manual acceptance test matrix

Complete and record these checks on a production-like preview before delivery:

1. Existing user can log in and see existing records unchanged.
2. Existing setup state remains complete; the setup route does not reopen.
3. Create/edit/view/archive/restore observation online.
4. Create/edit/status/note/archive/restore task online.
5. Create an activity with 2 elapsed hours and 4 selected staff; confirm 8 staff person-hours everywhere, including Excel.
6. Confirm the reporter is excluded unless selected.
7. Confirm no-participant activity requires an explicit hours-status choice.
8. Preload, enter airplane mode, browse records, create observation/task/activity/note/status/photo, close the app, reopen it, and confirm nothing is lost.
9. Reconnect and confirm every record and photograph appears once only and the queue clears.
10. Place a task and linked observation at different coordinates; confirm the task plots at its own location.
11. Confirm a named-location observation without direct GPS appears correctly.
12. Confirm today is not overdue and an impossible date is rejected.
13. Export/open `.xlsx` in Excel and check sheet names, dates, row counts and person-hours.
14. Generate the open-task meeting report with filters; verify ordering, exclusions, page layout and Save as PDF.
15. Verify keyboard focus, contrast, 200% zoom, touch targets and core flows at a common Android mobile viewport.
16. Verify logout/account change clears that account's cached dataset only after protecting unsynced work.
17. Verify the deployed `/api/healthz` and readiness route, application shell, service worker, manifest and security headers.

If real iPhone/Android testing is unavailable, automate what is possible, state exactly what remains untested and do not call the offline/mobile work fully verified.

## Delivery and GitHub procedure

1. Run the complete clean verification suite from the repository root using the pinned pnpm version:
   - `pnpm install --frozen-lockfile`
   - `pnpm run typecheck`
   - `pnpm run test`
   - `node --check artifacts/blickling-fieldbook/public/service-worker.js`
   - `pnpm run build:deploy`
   - `pnpm audit --prod --audit-level high`
2. Run `git diff --check`, confirm the working tree contains only intended source/docs/migration/test changes, and confirm no bundle, archive, database dump, `.env`, secret or generated dependency cache is committed.
3. Push the implementation branch without force.
4. Wait for and inspect GitHub Actions. A skipped, cancelled or partially executed workflow is not green.
5. If every local and GitHub check passes and `origin/main` is still exactly the recorded base commit, fast-forward `main` to the verified branch and push `main` without force. If main changed, checks fail, or branch protection requires a PR, stop and report the exact safe next action; do not override protection.
6. Republish the Replit deployment only after the verified commit is on `origin/main`. If Power Mode cannot safely republish, report `Republish required` with the verified commit SHA.
7. After deployment, perform non-destructive public smoke checks for the shell, manifest, service worker, liveness/readiness and security headers. Perform authenticated checks only with the already configured test account; never expose credentials.
8. If a production migration is pending and a recoverable backup cannot be confirmed, do not improvise. Report the exact migration and backup prerequisite.

## Required final response

Return one concise completion report containing:

- `PRE_CHANGE_HEAD`, final branch SHA and final `origin/main` SHA;
- checkpoints completed and any deliberately skipped item with reason;
- additive migrations/backfills applied and confirmation that no data was deleted;
- exact local check results and GitHub Actions result/link;
- manual acceptance results, clearly separating automated simulation from real-device testing;
- deployment status and production smoke results;
- remaining external actions/blockers;
- confirmation that no Phase 4 feature was implemented;
- confirmation that no force push, secret exposure, database reset or destructive migration occurred.

Do not say “everything works” unless every stated acceptance check actually passed. If anything fails, preserve the verified branch and existing production deployment, report the failure precisely, and stop rather than merging or publishing a partially verified build.
