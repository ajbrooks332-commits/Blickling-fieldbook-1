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

      const archive = await mutate(`/api/observations/${observation.id}`, "DELETE");
      assert.equal(archive.status, 204);
      const archivedAction = await fetch(`${origin}/api/actions/${action.id}`, { headers: { Cookie: cookie } });
      assert.equal(archivedAction.status, 404);

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
  } finally {
    await pool.end();
  }
});
