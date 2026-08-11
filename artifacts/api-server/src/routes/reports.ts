import { Router } from "express";
import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { actionsTable, categoriesTable, db, namedLocationsTable, observationsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { validationError } from "../lib/validation";

const router = Router();
const rangeSchema = z.object({ dateFrom: z.string().date(), dateTo: z.string().date() })
  .refine((value) => value.dateFrom <= value.dateTo, { message: "dateFrom must be on or before dateTo" })
  .refine((value) => Date.parse(`${value.dateTo}T00:00:00Z`) - Date.parse(`${value.dateFrom}T00:00:00Z`) <= 366 * 86_400_000,
    { message: "Report ranges cannot exceed 366 days" });

async function summary(propertyId: number, dateFrom: string, dateTo: string) {
  const obsBase = [eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt)];
  const actionBase = [eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt)];
  const obsPeriod = [sql`${observationsTable.createdAt} >= ${dateFrom}::date`, sql`${observationsTable.createdAt} < (${dateTo}::date + interval '1 day')`];
  const actionPeriod = [sql`${actionsTable.createdAt} >= ${dateFrom}::date`, sql`${actionsTable.createdAt} < (${dateTo}::date + interval '1 day')`];
  const activeObs = sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`;
  const [newObs, resolved, actionCreated, completed, overdue, urgent, high, safety, access, byCategory, byLocation] = await Promise.all([
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, ...obsPeriod)),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase,
      sql`${observationsTable.resolvedAt} >= ${dateFrom}::date`, sql`${observationsTable.resolvedAt} < (${dateTo}::date + interval '1 day')`)),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, ...actionPeriod)),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, eq(actionsTable.status, "completed"),
      sql`${actionsTable.completedAt} >= ${dateFrom}::date`, sql`${actionsTable.completedAt} < (${dateTo}::date + interval '1 day')`)),
    db.select({ value: count() }).from(actionsTable).where(and(...actionBase, sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
      sql`${actionsTable.dueDate}::date < (now() AT TIME ZONE 'Europe/London')::date`)),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.priority, "urgent"))),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.priority, "high"))),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.safetyIssue, true))),
    db.select({ value: count() }).from(observationsTable).where(and(...obsBase, activeObs, eq(observationsTable.publicAccessAffected, true))),
    db.select({ label: categoriesTable.name, value: count(), colour: categoriesTable.displayColour }).from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id)).where(and(...obsBase, ...obsPeriod))
      .groupBy(categoriesTable.name, categoriesTable.displayColour).orderBy(sql`count(*) DESC`),
    db.select({ label: namedLocationsTable.name, value: count() }).from(observationsTable)
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(and(...obsBase, ...obsPeriod, isNotNull(observationsTable.namedLocationId)))
      .groupBy(namedLocationsTable.name).orderBy(sql`count(*) DESC`),
  ]);
  const first = (rows: Array<{ value: number | bigint }>) => Number(rows[0]?.value ?? 0);
  return { dateFrom, dateTo, newObservations: first(newObs), resolvedObservations: first(resolved), actionsCreated: first(actionCreated),
    actionsCompleted: first(completed), overdueActions: first(overdue), urgentItems: first(urgent), highItems: first(high),
    outstandingSafetyIssues: first(safety), outstandingAccessIssues: first(access),
    byCategory: byCategory.map((row) => ({ label: row.label ?? "Unknown", value: Number(row.value), colour: row.colour ?? null })),
    byLocation: byLocation.map((row) => ({ label: row.label ?? "Unknown", value: Number(row.value), colour: null })) };
}

router.get("/summary", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  res.json(await summary(req.authUser!.propertyId!, parsed.data.dateFrom, parsed.data.dateTo));
});

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

router.get("/export.csv", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const rows = await db.select({ reference: observationsTable.referenceNumber, title: observationsTable.title,
    category: categoriesTable.name, location: namedLocationsTable.name, priority: observationsTable.priority,
    status: observationsTable.status, observedAt: observationsTable.observedAt, reporter: usersTable.name,
    safetyIssue: observationsTable.safetyIssue, publicAccessAffected: observationsTable.publicAccessAffected })
    .from(observationsTable).leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
    .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
    .where(and(eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt),
      sql`${observationsTable.createdAt} >= ${parsed.data.dateFrom}::date`,
      sql`${observationsTable.createdAt} < (${parsed.data.dateTo}::date + interval '1 day')`))
    .orderBy(observationsTable.createdAt);
  const headers = ["Reference", "Title", "Category", "Location", "Priority", "Status", "Observed at", "Reported by", "Safety issue", "Access affected"];
  const csv = [headers, ...rows.map((row) => Object.values(row))].map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="blickling-fieldbook-${parsed.data.dateFrom}-${parsed.data.dateTo}.csv"`);
  res.send(`\uFEFF${csv}`);
});

export default router;
