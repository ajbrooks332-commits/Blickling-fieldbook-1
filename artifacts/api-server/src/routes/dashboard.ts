import { Router } from "express";
import { db, observationsTable, actionsTable, usersTable, categoriesTable } from "@workspace/db";
import { eq, sql, count, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /dashboard/summary
router.get("/summary", requireAuth, async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    [{ openObservations }],
    [{ urgentObservations }],
    [{ highObservations }],
    [{ overdueActions }],
    [{ actionsDueThisWeek }],
    [{ observationsLast30Days }],
    [{ actionsCompletedLast30Days }],
  ] = await Promise.all([
    db.select({ openObservations: count() }).from(observationsTable)
      .where(sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`),
    db.select({ urgentObservations: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.priority, "urgent"),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({ highObservations: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.priority, "high"),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({ overdueActions: count() }).from(actionsTable)
      .where(and(
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`${actionsTable.dueDate} < NOW()`
      )),
    db.select({ actionsDueThisWeek: count() }).from(actionsTable)
      .where(and(
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`${actionsTable.dueDate} >= NOW()`,
        sql`${actionsTable.dueDate} <= ${endOfWeek.toISOString()}::timestamptz`
      )),
    db.select({ observationsLast30Days: count() }).from(observationsTable)
      .where(sql`${observationsTable.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`),
    db.select({ actionsCompletedLast30Days: count() }).from(actionsTable)
      .where(and(
        eq(actionsTable.status, "completed"),
        sql`${actionsTable.completedAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`
      )),
  ]);

  res.json({
    openObservations: Number(openObservations),
    urgentObservations: Number(urgentObservations),
    highObservations: Number(highObservations),
    overdueActions: Number(overdueActions),
    actionsDueThisWeek: Number(actionsDueThisWeek),
    observationsLast30Days: Number(observationsLast30Days),
    actionsCompletedLast30Days: Number(actionsCompletedLast30Days),
  });
});

// GET /dashboard/charts
router.get("/charts", requireAuth, async (req, res) => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [byCategory, byStatus, actionsByAssignee, observationsOverTime] = await Promise.all([
    // By category
    db.select({
      label: categoriesTable.name,
      value: count(),
      colour: categoriesTable.displayColour,
    })
      .from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .where(sql`${observationsTable.status} NOT IN ('closed', 'cancelled')`)
      .groupBy(categoriesTable.name, categoriesTable.displayColour)
      .orderBy(sql`count(*) DESC`)
      .limit(10),
    // By status
    db.select({
      label: observationsTable.status,
      value: count(),
    })
      .from(observationsTable)
      .groupBy(observationsTable.status)
      .orderBy(sql`count(*) DESC`),
    // Actions by assignee
    db.select({
      label: usersTable.name,
      value: count(),
    })
      .from(actionsTable)
      .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
      .where(sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`)
      .groupBy(usersTable.name)
      .orderBy(sql`count(*) DESC`)
      .limit(10),
    // Observations over time (last 90 days, by week)
    db.execute(sql`
      SELECT 
        DATE_TRUNC('week', created_at)::date::text AS date,
        COUNT(*)::int AS value
      FROM observations
      WHERE created_at >= ${ninetyDaysAgo.toISOString()}::timestamptz
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at)
    `),
  ]);

  res.json({
    byCategory: byCategory.map((r) => ({ label: r.label ?? "Unknown", value: Number(r.value), colour: r.colour ?? null })),
    byStatus: byStatus.map((r) => ({ label: r.label, value: Number(r.value), colour: null })),
    actionsByAssignee: actionsByAssignee.map((r) => ({ label: r.label ?? "Unassigned", value: Number(r.value), colour: null })),
    observationsOverTime: (observationsOverTime.rows as any[]).map((r) => ({ date: r.date, value: r.value })),
  });
});

export default router;
