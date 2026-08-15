import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

test("migrations bootstrap an empty PostgreSQL database and remain idempotent", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const [{ runMigrations }, { pool }] = await Promise.all([
    import("./migrations"),
    import("@workspace/db"),
  ]);

  try {
    await runMigrations();
    await runMigrations();

    const result = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tables = new Set(result.rows.map((row) => row.table_name));
    for (const expected of [
      "properties", "users", "categories", "named_locations", "observations", "actions",
      "notes", "audit_events", "observation_images", "action_images", "app_settings",
      "upload_grants", "reference_counters", "session",
    ]) {
      assert.equal(tables.has(expected), true, `missing table: ${expected}`);
    }

    const settings = await pool.query("SELECT setup_completed_at FROM app_settings WHERE id = 1");
    assert.equal(settings.rowCount, 1);

    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "integration-test-session-secret-more-than-32-characters";
    process.env.SETUP_SECRET = "integration-test-setup-secret-2026";
    const { default: app } = await import("../app");
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    try {
      const port = (server.address() as AddressInfo).port;
      const origin = `http://127.0.0.1:${port}`;
      const health = await fetch(`${origin}/api/healthz`);
      assert.equal(health.status, 200);

      const setup = await fetch(`${origin}/api/auth/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": origin,
          "X-Requested-With": "BlicklingFieldbook",
        },
        body: JSON.stringify({
          setupSecret: process.env.SETUP_SECRET,
          name: "Integration Administrator",
          email: "integration@example.invalid",
          password: "Integration-Fieldbook-2026!",
        }),
      });
      const setupBody = await setup.text();
      assert.equal(setup.status, 201, setupBody);
      assert.match(setup.headers.get("set-cookie") ?? "", /^blickling\.sid=/);
      const admin = JSON.parse(setupBody) as { id: number };
      const cookie = (setup.headers.get("set-cookie") ?? "").split(";", 1)[0];

      const mutate = (path: string, method: string, body?: unknown) => fetch(`${origin}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookie,
          "Origin": origin,
          "X-Requested-With": "BlicklingFieldbook",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const categoriesResponse = await fetch(`${origin}/api/categories`, { headers: { Cookie: cookie } });
      assert.equal(categoriesResponse.status, 200);
      const categories = await categoriesResponse.json() as Array<{ id: number }>;

      const observationResponse = await mutate("/api/observations", "POST", {
        title: "Integration observation",
        categoryId: categories[0].id,
        priority: "normal",
        status: "submitted",
        observedAt: new Date().toISOString(),
        offlineId: "00000000-0000-4000-8000-000000000001",
      });
      const observationBody = await observationResponse.text();
      assert.equal(observationResponse.status, 201, observationBody);
      const observation = JSON.parse(observationBody) as { id: number };

      const actionResponse = await mutate("/api/actions", "POST", {
        title: "Integration action",
        observationId: observation.id,
        assignedToUserId: admin.id,
        priority: "high",
        status: "not_started",
        offlineId: "00000000-0000-4000-8000-000000000002",
      });
      const actionBody = await actionResponse.text();
      assert.equal(actionResponse.status, 201, actionBody);
      const action = JSON.parse(actionBody) as { id: number };

      const progress = await mutate(`/api/actions/${action.id}/status`, "PATCH", { status: "in_progress" });
      assert.equal(progress.status, 200, await progress.text());
      const complete = await mutate(`/api/actions/${action.id}/status`, "PATCH", {
        status: "completed",
        completionNote: "Verified by the integration test",
      });
      assert.equal(complete.status, 200, await complete.text());

      const noteInput = {
        body: "Integration note",
        observationId: observation.id,
        offlineId: "00000000-0000-4000-8000-000000000003",
      };
      const firstNote = await mutate("/api/notes", "POST", noteInput);
      assert.equal(firstNote.status, 201, await firstNote.text());
      const replayedNote = await mutate("/api/notes", "POST", noteInput);
      assert.equal(replayedNote.status, 200, await replayedNote.text());
      assert.equal(replayedNote.headers.get("x-idempotent-replay"), "true");

      // --- Regression: impossible calendar dates are rejected at the API boundary ---
      const badDate = await mutate("/api/actions", "POST", {
        title: "Bad date", assignedToUserId: admin.id, priority: "low", dueDate: "2026-02-31",
      });
      assert.equal(badDate.status, 400, await badDate.text());

      // --- Regression: creating a task must not perform invalid observation transitions ---
      const draftObs = await mutate("/api/observations", "POST", {
        title: "Draft observation", categoryId: categories[0].id, priority: "normal",
        status: "draft", observedAt: new Date().toISOString(),
      });
      assert.equal(draftObs.status, 201);
      const draft = await draftObs.json() as { id: number };
      const draftAction = await mutate("/api/actions", "POST", {
        title: "Task on draft", observationId: draft.id, assignedToUserId: admin.id, priority: "normal",
      });
      assert.equal(draftAction.status, 201);
      const draftActionBody = await draftAction.json() as { observationTransition: { applied: boolean; observationStatus: string } };
      assert.deepEqual(draftActionBody.observationTransition, { applied: false, observationStatus: "draft" });
      const draftAfter = await fetch(`${origin}/api/observations/${draft.id}`, { headers: { Cookie: cookie } });
      assert.equal(((await draftAfter.json()) as { status: string }).status, "draft");

      const submittedObs = await mutate("/api/observations", "POST", {
        title: "Submitted observation", categoryId: categories[0].id, priority: "normal",
        status: "submitted", observedAt: new Date().toISOString(),
      });
      const submitted = await submittedObs.json() as { id: number };
      const submittedAction = await mutate("/api/actions", "POST", {
        title: "Task on submitted", observationId: submitted.id, assignedToUserId: admin.id, priority: "normal",
      });
      const submittedActionBody = await submittedAction.json() as { observationTransition: { applied: boolean; observationStatus: string } };
      assert.deepEqual(submittedActionBody.observationTransition, { applied: true, observationStatus: "action_required" });
      const submittedAfter = await fetch(`${origin}/api/observations/${submitted.id}`, { headers: { Cookie: cookie } });
      assert.equal(((await submittedAfter.json()) as { status: string }).status, "action_required");

      // --- Regression: closed bucket contains completed and cancelled only; overdue is open-only ---
      const closedList = await fetch(`${origin}/api/actions?bucket=closed`, { headers: { Cookie: cookie } });
      assert.equal(closedList.status, 200);
      const closed = await closedList.json() as { actions: Array<{ status: string }> };
      assert.equal(closed.actions.length >= 1, true);
      for (const row of closed.actions) assert.equal(["completed", "cancelled"].includes(row.status), true);
      const closedOverdue = await fetch(`${origin}/api/actions?bucket=closed&overdue=true`, { headers: { Cookie: cookie } });
      assert.equal(closedOverdue.status, 400);

      // --- Regression: map coordinate precedence and inactive-location rejection ---
      const locRes = await mutate("/api/locations", "POST", { name: "Map test paddock", latitude: 52.9, longitude: 1.4 });
      assert.equal(locRes.status, 201);
      const mapLoc = await locRes.json() as { id: number };

      const gpsObsRes = await mutate("/api/observations", "POST", {
        title: "GPS observation for map", categoryId: categories[0].id, priority: "normal",
        status: "submitted", observedAt: new Date().toISOString(), latitude: 52.7, longitude: 1.1,
      });
      const gpsObs = await gpsObsRes.json() as { id: number };
      const locatedActionRes = await mutate("/api/actions", "POST", {
        title: "Task with own location", observationId: gpsObs.id, namedLocationId: mapLoc.id,
        assignedToUserId: admin.id, priority: "normal",
      });
      assert.equal(locatedActionRes.status, 201);
      const locatedAction = await locatedActionRes.json() as { id: number };
      const actionMap = await fetch(`${origin}/api/actions/map`, { headers: { Cookie: cookie } });
      assert.equal(actionMap.status, 200);
      const actionRows = await actionMap.json() as Array<{ id: number; latitude: string | number; longitude: string | number }>;
      const locatedRow = actionRows.find((r) => r.id === locatedAction.id);
      assert.ok(locatedRow, "task with own location should appear on the map");
      // The task's OWN named location outranks the linked observation's GPS point.
      assert.equal(Number(locatedRow!.latitude), 52.9);
      assert.equal(Number(locatedRow!.longitude), 1.4);

      const noGpsObsRes = await mutate("/api/observations", "POST", {
        title: "Named-location observation", categoryId: categories[0].id, priority: "normal",
        status: "submitted", observedAt: new Date().toISOString(), namedLocationId: mapLoc.id,
      });
      const noGpsObs = await noGpsObsRes.json() as { id: number };
      const obsMap = await fetch(`${origin}/api/observations/map`, { headers: { Cookie: cookie } });
      const obsRows = await obsMap.json() as Array<{ id: number; latitude: string | number; longitude: string | number }>;
      const fallbackRow = obsRows.find((r) => r.id === noGpsObs.id);
      assert.ok(fallbackRow, "observation without GPS should fall back to its named location");
      assert.equal(Number(fallbackRow!.latitude), 52.9);

      const deactivate = await mutate(`/api/locations/${mapLoc.id}`, "PATCH", { active: false });
      assert.equal(deactivate.status, 200);
      const inactiveAction = await mutate("/api/actions", "POST", {
        title: "Task at inactive location", namedLocationId: mapLoc.id, assignedToUserId: admin.id, priority: "low",
      });
      assert.equal(inactiveAction.status, 400);
      const typesRes = await fetch(`${origin}/api/activity-types`, { headers: { Cookie: cookie } });
      const activityTypes = await typesRes.json() as Array<{ id: number }>;
      assert.ok(activityTypes.length > 0, "seeded activity types expected");
      const inactiveActivity = await mutate("/api/activities", "POST", {
        activityTypeId: activityTypes[0].id, namedLocationIds: [mapLoc.id], activityDate: "2026-08-01",
        durationMinutes: 60, participantUserIds: [admin.id],
      });
      assert.equal(inactiveActivity.status, 400);

      // --- Regression: activity labour model (person-hours vs elapsed hours) ---
      const typesRes2 = await fetch(`${origin}/api/activity-types`, { headers: { Cookie: cookie } });
      const actTypes = await typesRes2.json() as Array<{ id: number }>;
      const typeId = actTypes[0].id;
      const activityDate = new Date().toISOString().slice(0, 10);

      // Zero participants without an explicit hours status must be rejected.
      const noStatus = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 60, participantUserIds: [],
      });
      assert.equal(noStatus.status, 400);

      // 2 elapsed hours x 4 staff = 8 staff person-hours. (Use available users; here 1 admin.)
      const staffAct = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 120, participantUserIds: [admin.id],
      });
      assert.equal(staffAct.status, 201);

      // Elapsed-only and mixed volunteer/contractor cases.
      const elapsedOnly = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 60, participantUserIds: [], hoursStatus: "elapsed_only",
      });
      assert.equal(elapsedOnly.status, 201);
      const mixed = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 90, participantUserIds: [admin.id],
        volunteerCount: 2, contractorHoursUnknown: true,
      });
      assert.equal(mixed.status, 201);
      // Contractor hours cannot be both recorded and unknown.
      const conflict = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 60, participantUserIds: [],
        contractorMinutes: 60, contractorHoursUnknown: true,
      });
      assert.equal(conflict.status, 400);

      const actList = await fetch(`${origin}/api/activities`, { headers: { Cookie: cookie } });
      const actListBody = await actList.json() as { activities: Array<{ durationMinutes: number; elapsedMinutes: number;
        hoursStatus: string; staffPersonMinutes: number; volunteerPersonMinutes: number | null;
        contractorMinutes: number | null; contractorHoursUnknown: boolean }> };
      const staffRow = actListBody.activities.find((a) => a.durationMinutes === 120);
      assert.ok(staffRow);
      assert.equal(staffRow!.hoursStatus, "staff_participants");
      assert.equal(staffRow!.staffPersonMinutes, 120); // 1 participant x 120 min
      const elapsedRow = actListBody.activities.find((a) => a.durationMinutes === 60 && a.hoursStatus === "elapsed_only");
      assert.ok(elapsedRow);
      assert.equal(elapsedRow!.staffPersonMinutes, 0);
      const mixedRow = actListBody.activities.find((a) => a.durationMinutes === 90);
      assert.ok(mixedRow);
      assert.equal(mixedRow!.staffPersonMinutes, 90);
      assert.equal(mixedRow!.volunteerPersonMinutes, 180); // 2 volunteers x 90 min
      assert.equal(mixedRow!.contractorHoursUnknown, true);
      assert.equal(mixedRow!.contractorMinutes, null); // unknown stays unknown, never zero

      const actReport = await fetch(`${origin}/api/activities/report`, { headers: { Cookie: cookie } });
      const reportBody = await actReport.json() as { totalMinutes: number; totalStaffPersonMinutes: number;
        totalVolunteerPersonMinutes: number; contractorUnknownCount: number; unattributedCount: number };
      assert.equal(reportBody.totalMinutes, 270);
      assert.equal(reportBody.totalStaffPersonMinutes, 210);
      assert.equal(reportBody.totalVolunteerPersonMinutes, 180);
      assert.equal(reportBody.contractorUnknownCount, 1);
      assert.equal(reportBody.unattributedCount, 1);

      // --- Regression: report periods judged by observedAt, not createdAt ---
      const backObs = await mutate("/api/observations", "POST", {
        title: "Backdated observation", categoryId: categories[0].id, priority: "normal",
        status: "submitted", observedAt: "2020-06-15T10:00:00.000Z",
      });
      assert.equal(backObs.status, 201);
      const backSummary = await fetch(`${origin}/api/reports/summary?dateFrom=2020-06-01&dateTo=2020-06-30`, { headers: { Cookie: cookie } });
      assert.equal(backSummary.status, 200);
      const backSummaryBody = await backSummary.json() as { newObservations: number };
      assert.equal(backSummaryBody.newObservations, 1);
      // Historical export beyond 366 days must not be blocked.
      const longExport = await fetch(`${origin}/api/reports/export.csv?dateFrom=2019-01-01&dateTo=2026-12-31`, { headers: { Cookie: cookie } });
      assert.equal(longExport.status, 200);
      const longCsv = await longExport.text();
      assert.ok(longCsv.includes("Backdated observation"));
      assert.ok(longCsv.includes("Created at"), "process timestamps retained in export");

      // --- Regression: offline snapshot + activity idempotency ---
      const offlineId = crypto.randomUUID();
      const firstReplay = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 30, participantUserIds: [], hoursStatus: "elapsed_only", offlineId,
      });
      assert.equal(firstReplay.status, 201);
      const firstReplayBody = await firstReplay.json() as { id: number };
      const secondReplay = await mutate("/api/activities", "POST", {
        activityTypeId: typeId, activityDate, durationMinutes: 30, participantUserIds: [], hoursStatus: "elapsed_only", offlineId,
      });
      assert.equal(secondReplay.status, 200); // replay, not duplicate
      const secondReplayBody = await secondReplay.json() as { id: number };
      assert.equal(secondReplayBody.id, firstReplayBody.id);

      const snapshotRes = await fetch(`${origin}/api/offline/snapshot`, { headers: { Cookie: cookie } });
      assert.equal(snapshotRes.status, 200);
      const snapshot = await snapshotRes.json() as Record<string, unknown[]> & { serverTime: string };
      assert.ok(snapshot.serverTime);
      assert.ok((snapshot.observations as unknown[]).length >= 1);
      assert.ok((snapshot.activities as unknown[]).length >= 4);
      assert.ok((snapshot.categories as unknown[]).length >= 1);
      assert.ok(Array.isArray(snapshot.activityParticipants));

      const archive = await mutate(`/api/observations/${observation.id}`, "DELETE");
      assert.equal(archive.status, 204);
      const archivedAction = await fetch(`${origin}/api/actions/${action.id}`, { headers: { Cookie: cookie } });
      assert.equal(archivedAction.status, 404);

      // --- Regression: archived lists + restore (managers) ---
      const archivedObsList = await fetch(`${origin}/api/observations/archived`, { headers: { Cookie: cookie } });
      assert.equal(archivedObsList.status, 200);
      const archivedObsBody = await archivedObsList.json() as { observations: Array<{ id: number; archivedAt: string | null }> };
      assert.ok(archivedObsBody.observations.some((o) => o.id === observation.id && o.archivedAt));
      const archivedActList = await fetch(`${origin}/api/actions/archived`, { headers: { Cookie: cookie } });
      assert.equal(archivedActList.status, 200);
      const archivedActBody = await archivedActList.json() as { actions: Array<{ id: number }> };
      assert.ok(archivedActBody.actions.some((a) => a.id === action.id));

      // Restoring a task under an archived observation must 409 first.
      const blockedRestore = await mutate(`/api/actions/${action.id}/restore`, "POST", {});
      assert.equal(blockedRestore.status, 409);
      const obsRestore = await mutate(`/api/observations/${observation.id}/restore`, "POST", {});
      assert.equal(obsRestore.status, 200);
      const actRestore = await mutate(`/api/actions/${action.id}/restore`, "POST", {});
      assert.equal(actRestore.status, 200);
      const restoredAction = await fetch(`${origin}/api/actions/${action.id}`, { headers: { Cookie: cookie } });
      assert.equal(restoredAction.status, 200);
      // Audit history preserved through archive/restore.
      const restoredObservation = await fetch(`${origin}/api/observations/${observation.id}`, { headers: { Cookie: cookie } });
      assert.equal(restoredObservation.status, 200);
      const restoredObsBody = await restoredObservation.json() as { auditEvents: Array<{ eventType: string }> };
      assert.ok(restoredObsBody.auditEvents.some((e) => e.eventType === "observation_archived"));
      assert.ok(restoredObsBody.auditEvents.some((e) => e.eventType === "observation_restored"));

      // Meeting pack: open tasks only, with counts and latest-note field.
      const pack = await fetch(`${origin}/api/actions/meeting-pack`, { headers: { Cookie: cookie } });
      assert.equal(pack.status, 200);
      const packBody = await pack.json() as { counts: { total: number }; tasks: Array<{ id: number; status: string }> };
      // This action was completed earlier in the flow, so the pack must exclude it.
      assert.ok(packBody.tasks.every((t) => t.id !== action.id));
      assert.ok(packBody.tasks.every((t) => t.status !== "completed" && t.status !== "cancelled"));
      assert.equal(packBody.counts.total, packBody.tasks.length);

      // Re-archive so later reference-data assertions see the original state.
      const rearchiveAct = await mutate(`/api/actions/${action.id}`, "DELETE");
      assert.equal(rearchiveAct.status, 204);
      const rearchiveObs = await mutate(`/api/observations/${observation.id}`, "DELETE");
      assert.equal(rearchiveObs.status, 204);

      const referenceData = await pool.query(`
        SELECT
          (SELECT count(*)::int FROM users WHERE active) AS users,
          (SELECT count(*)::int FROM categories WHERE active) AS categories,
          (SELECT count(*)::int FROM named_locations WHERE active) AS locations,
          (SELECT (setup_completed_at IS NOT NULL) FROM app_settings WHERE id = 1) AS setup_complete
      `);
      assert.deepEqual(referenceData.rows[0], { users: 1, categories: 8, locations: 6, setup_complete: true });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }

    // --- Migration ledger ---
    const { migrationLedger } = await import("./migrations");
    const ledger = await pool.query<{ version: number; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version");
    assert.equal(ledger.rowCount, migrationLedger.statements.length);
    assert.equal(ledger.rows[0].checksum, migrationLedger.checksum(migrationLedger.statements[0]));

    // Tampered history must fail loudly, not silently re-run.
    await pool.query("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1");
    await assert.rejects(runMigrations(), /ledger mismatch at version 1/);
    await pool.query("UPDATE schema_migrations SET checksum = $1 WHERE version = 1",
      [migrationLedger.checksum(migrationLedger.statements[0])]);

    // Pre-ledger database (schema + data exist, no schema_migrations): the
    // baseline run must record the full ledger and preserve live data.
    const before = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM users");
    await pool.query("DROP TABLE schema_migrations");
    await runMigrations();
    const rebaselined = await pool.query("SELECT count(*)::int AS n FROM schema_migrations");
    assert.equal(rebaselined.rows[0].n, migrationLedger.statements.length);
    const after = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM users");
    assert.equal(after.rows[0].n, before.rows[0].n);

    // --- Development seed: must complete on a database containing activity
    // references (activity logs/participants/locations reference users,
    // types and named locations), and must be explicitly opted into.
    const seedModule = await import("../seed");
    delete process.env.ALLOW_DESTRUCTIVE_SEED;
    await assert.rejects(seedModule.seed(), /ALLOW_DESTRUCTIVE_SEED/);

    const [{ uid, locid }] = (await pool.query<{ uid: number; locid: number }>(
      "SELECT (SELECT id FROM users LIMIT 1) AS uid, (SELECT id FROM named_locations LIMIT 1) AS locid")).rows;
    const typeRow = await pool.query<{ id: number }>(
      "INSERT INTO activity_types (property_id, name, category) SELECT id, 'Seed test type', 'Other' FROM properties LIMIT 1 RETURNING id");
    const logRow = await pool.query<{ id: number }>(
      `INSERT INTO activity_logs (property_id, activity_type_id, named_location_id, activity_date, duration_minutes, recorded_by_user_id)
       SELECT p.id, $1, $2, '2026-08-01', 60, $3 FROM properties p LIMIT 1 RETURNING id`,
      [typeRow.rows[0].id, locid, uid]);
    await pool.query("INSERT INTO activity_log_participants (activity_log_id, user_id) VALUES ($1, $2)", [logRow.rows[0].id, uid]);
    await pool.query("INSERT INTO activity_log_locations (activity_log_id, named_location_id) VALUES ($1, $2)", [logRow.rows[0].id, locid]);

    process.env.ALLOW_DESTRUCTIVE_SEED = "true";
    await seedModule.seed();
    const seeded = await pool.query(`
      SELECT (SELECT count(*)::int FROM activity_logs) AS logs,
             (SELECT count(*)::int FROM users) AS users,
             (SELECT count(*)::int FROM categories) AS categories,
             (SELECT count(*)::int FROM named_locations) AS locations`);
    assert.equal(seeded.rows[0].logs, 0);
    assert.equal(seeded.rows[0].users, 0);
    assert.ok(seeded.rows[0].categories > 0);
    assert.ok(seeded.rows[0].locations > 0);
  } finally {
    await pool.end();
  }
});
