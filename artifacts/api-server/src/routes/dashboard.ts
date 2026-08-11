import { Router } from "express";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { actionsTable, categoriesTable, db, observationsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const propertyId = req.authUser!.propertyId!;
  const obsBase = [eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt)];
  const actionBase = [eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt)];
  const activeObs = sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`;
  const activeAction = sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`;
  const ukToday = sql`(now() AT TIME ZONE 'Europe/London')::date`;
  const results = await Promise.all([
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs)),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.priority, "urgent"))),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.priority, "high"))),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, activeAction, sql`${actionsTable.dueDate}::date < ${ukToday}`)),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, activeAction,
      sql`${actionsTable.dueDate}::date >= ${ukToday}`, sql`${actionsTable.dueDate}::date <= ${ukToday} + 7`)),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, sql`${observationsTable.createdAt} >= now() - interval '30 days'`)),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, eq(actionsTable.status, "completed"),
      sql`${actionsTable.completedAt} >= now() - interval '30 days'`)),
  ]);
  const values = results.map((rows) => Number(rows[0]?.value ?? 0));
  res.json({ openObservations: values[0], urgentObservations: values[1], highObservations: values[2], overdueActions: values[3],
    actionsDueThisWeek: values[4], observationsLast30Days: values[5], actionsCompletedLast30Days: values[6] });
});

router.get("/charts", requireAuth, async (req, res) => {
  const propertyId = req.authUser!.propertyId!;
  const activeObs = sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`;
  const [byCategory, byStatus, actionsByAssignee, observationsOverTime] = await Promise.all([
    db.select({ label: categoriesTable.name, value: count(), colour: categoriesTable.displayColour })
      .from(observationsTable).leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .where(and(eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt), activeObs))
      .groupBy(categoriesTable.name, categoriesTable.displayColour).orderBy(sql`count(*) DESC`).limit(10),
    db.select({ label: observationsTable.status, value: count() }).from(observationsTable)
      .where(and(eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt), activeObs))
      .groupBy(observationsTable.status).orderBy(sql`count(*) DESC`),
    db.select({ label: usersTable.name, value: count() }).from(actionsTable)
      .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
      .where(and(eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt),
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`))
      .groupBy(usersTable.name).orderBy(sql`count(*) DESC`).limit(10),
    db.execute(sql`SELECT date_trunc('week', created_at)::date::text AS date, count(*)::int AS value
      FROM observations WHERE property_id = ${propertyId} AND deleted_at IS NULL
      AND created_at >= now() - interval '30 days' GROUP BY date_trunc('week', created_at) ORDER BY date_trunc('week', created_at)`),
  ]);
  res.json({
    byCategory: byCategory.map((row) => ({ label: row.label ?? "Unknown", value: Number(row.value), colour: row.colour ?? null })),
    byStatus: byStatus.map((row) => ({ label: row.label, value: Number(row.value), colour: null })),
    actionsByAssignee: actionsByAssignee.map((row) => ({ label: row.label ?? "Unassigned", value: Number(row.value), colour: null })),
    observationsOverTime: (observationsOverTime.rows as Array<{ date: string; value: number }>).map((row) => ({ date: row.date, value: Number(row.value) })),
  });
});

export default router;
