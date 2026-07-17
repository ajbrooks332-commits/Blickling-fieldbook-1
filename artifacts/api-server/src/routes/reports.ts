import { Router } from "express";
import { db, observationsTable, actionsTable, categoriesTable, namedLocationsTable } from "@workspace/db";
import { eq, sql, count, and, isNotNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /reports/summary
router.get("/summary", requireAuth, async (req, res) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: "dateFrom and dateTo are required" });
    return;
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const [
    [{ newObservations }],
    [{ resolvedObservations }],
    [{ actionsCreated }],
    [{ actionsCompleted }],
    [{ overdueActions }],
    [{ urgentItems }],
    [{ highItems }],
    [{ outstandingSafetyIssues }],
    [{ outstandingAccessIssues }],
    byCategory,
    byLocation,
  ] = await Promise.all([
    db.select({ newObservations: count() }).from(observationsTable)
      .where(and(
        sql`${observationsTable.createdAt} >= ${from.toISOString()}::timestamptz`,
        sql`${observationsTable.createdAt} <= ${to.toISOString()}::timestamptz`
      )),
    db.select({ resolvedObservations: count() }).from(observationsTable)
      .where(and(
        sql`${observationsTable.resolvedAt} >= ${from.toISOString()}::timestamptz`,
        sql`${observationsTable.resolvedAt} <= ${to.toISOString()}::timestamptz`
      )),
    db.select({ actionsCreated: count() }).from(actionsTable)
      .where(and(
        sql`${actionsTable.createdAt} >= ${from.toISOString()}::timestamptz`,
        sql`${actionsTable.createdAt} <= ${to.toISOString()}::timestamptz`
      )),
    db.select({ actionsCompleted: count() }).from(actionsTable)
      .where(and(
        eq(actionsTable.status, "completed"),
        sql`${actionsTable.completedAt} >= ${from.toISOString()}::timestamptz`,
        sql`${actionsTable.completedAt} <= ${to.toISOString()}::timestamptz`
      )),
    db.select({ overdueActions: count() }).from(actionsTable)
      .where(and(
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`${actionsTable.dueDate} < NOW()`
      )),
    db.select({ urgentItems: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.priority, "urgent"),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({ highItems: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.priority, "high"),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({ outstandingSafetyIssues: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.safetyIssue, true),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({ outstandingAccessIssues: count() }).from(observationsTable)
      .where(and(
        eq(observationsTable.publicAccessAffected, true),
        sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`
      )),
    db.select({
      label: categoriesTable.name,
      value: count(),
      colour: categoriesTable.displayColour,
    })
      .from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .where(and(
        sql`${observationsTable.createdAt} >= ${from.toISOString()}::timestamptz`,
        sql`${observationsTable.createdAt} <= ${to.toISOString()}::timestamptz`
      ))
      .groupBy(categoriesTable.name, categoriesTable.displayColour)
      .orderBy(sql`count(*) DESC`),
    db.select({
      label: namedLocationsTable.name,
      value: count(),
    })
      .from(observationsTable)
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(and(
        sql`${observationsTable.createdAt} >= ${from.toISOString()}::timestamptz`,
        sql`${observationsTable.createdAt} <= ${to.toISOString()}::timestamptz`,
        sql`${observationsTable.namedLocationId} IS NOT NULL`
      ))
      .groupBy(namedLocationsTable.name)
      .orderBy(sql`count(*) DESC`),
  ]);

  res.json({
    dateFrom,
    dateTo,
    newObservations: Number(newObservations),
    resolvedObservations: Number(resolvedObservations),
    actionsCreated: Number(actionsCreated),
    actionsCompleted: Number(actionsCompleted),
    overdueActions: Number(overdueActions),
    urgentItems: Number(urgentItems),
    highItems: Number(highItems),
    outstandingSafetyIssues: Number(outstandingSafetyIssues),
    outstandingAccessIssues: Number(outstandingAccessIssues),
    byCategory: byCategory.map((r) => ({ label: r.label ?? "Unknown", value: Number(r.value), colour: r.colour ?? null })),
    byLocation: byLocation.map((r) => ({ label: r.label ?? "Unknown", value: Number(r.value), colour: null })),
  });
});

export default router;
