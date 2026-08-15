import { Router } from "express";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  actionsTable, auditEventsTable, db, namedLocationsTable, notesTable, observationsTable, usersTable,
} from "@workspace/db";
import { canUpdateAction, isManager, requireAuth, requireRole } from "../lib/auth";
import { generateActionRef } from "../lib/references";
import { calendarDate, idSchema, isPostgresError, optionalText, shortText, validationError } from "../lib/validation";
import { actionStatuses, actionTransitions, canTransition, observationTransitions, type ObservationStatus } from "../lib/workflows";

const router = Router();
const priority = z.enum(["low", "normal", "high", "urgent"]);
const status = z.enum(actionStatuses);
const dueDate = calendarDate;
const createSchema = z.object({
  title: shortText, description: optionalText(10000), observationId: z.number().int().positive().optional().nullable(),
  namedLocationId: z.number().int().positive().optional().nullable(),
  assignedToUserId: z.number().int().positive(), priority, status: z.enum(["not_started", "planned"]).default("not_started"),
  dueDate: dueDate.optional().nullable(), estimatedMinutes: z.number().int().min(0).max(525600).optional().nullable(),
  equipmentRequired: z.boolean().default(false), contractorRequired: z.boolean().default(false),
  notes: z.string().trim().max(5000).optional().nullable(),
  createdOffline: z.boolean().default(false), offlineId: z.string().uuid().optional().nullable(),
  deviceCreatedAt: z.string().datetime({ offset: true }).optional().nullable(),
}).strict();
const updateSchema = createSchema.omit({ status: true, notes: true, createdOffline: true, offlineId: true, deviceCreatedAt: true }).partial()
  // Optimistic concurrency token: the record's updatedAt as last seen by the
  // editor. A mismatch means someone else saved in the meantime → 409.
  .extend({ expectedUpdatedAt: z.string().datetime().optional() }).strict();

const actionFields = {
  id: actionsTable.id, referenceNumber: actionsTable.referenceNumber, title: actionsTable.title,
  description: actionsTable.description, observationId: actionsTable.observationId, observationTitle: observationsTable.title,
  observationRef: observationsTable.referenceNumber, assignedToUserId: actionsTable.assignedToUserId,
  assignedToName: usersTable.name, createdByUserId: actionsTable.createdByUserId, priority: actionsTable.priority,
  status: actionsTable.status, dueDate: actionsTable.dueDate, completedAt: actionsTable.completedAt,
  completionNote: actionsTable.completionNote, namedLocationId: actionsTable.namedLocationId,
  namedLocationName: namedLocationsTable.name,
  estimatedMinutes: actionsTable.estimatedMinutes, equipmentRequired: actionsTable.equipmentRequired,
  contractorRequired: actionsTable.contractorRequired, waitingReason: actionsTable.waitingReason,
  cancellationReason: actionsTable.cancellationReason, propertyId: actionsTable.propertyId,
  createdAt: actionsTable.createdAt, updatedAt: actionsTable.updatedAt,
};

const formatAction = (row: typeof actionFields extends never ? never : Record<string, unknown>) => ({ ...row });
const toDueDate = (value?: string | null) => value ? new Date(`${value}T12:00:00.000Z`) : null;

async function validateAssignee(propertyId: number, userId: number) {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, userId),
    eq(usersTable.propertyId, propertyId), eq(usersTable.active, true))).limit(1);
  return Boolean(user);
}

async function validateObservation(propertyId: number, observationId?: number | null) {
  if (!observationId) return true;
  const [row] = await db.select({ id: observationsTable.id }).from(observationsTable).where(and(eq(observationsTable.id, observationId),
    eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt))).limit(1);
  return Boolean(row);
}

async function validateLocation(propertyId: number, namedLocationId?: number | null) {
  if (!namedLocationId) return true;
  const [row] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
    .where(and(eq(namedLocationsTable.id, namedLocationId), eq(namedLocationsTable.propertyId, propertyId),
      eq(namedLocationsTable.active, true))).limit(1);
  return Boolean(row);
}

function baseSelect() {
  return db.select(actionFields).from(actionsTable)
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    // An action's own location wins; otherwise fall back to the linked observation's location.
    .leftJoin(namedLocationsTable, eq(namedLocationsTable.id,
      sql`COALESCE(${actionsTable.namedLocationId}, ${observationsTable.namedLocationId})`));
}

router.get("/my", requireAuth, async (req, res) => {
  const user = req.authUser!;
  const base = [eq(actionsTable.propertyId, user.propertyId!), eq(actionsTable.assignedToUserId, user.id), isNull(actionsTable.deletedAt)];
  const active = sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`;
  const ukDate = sql`(now() AT TIME ZONE 'Europe/London')::date`;
  const [overdue, dueToday, dueThisWeek, later, recentlyCompleted] = await Promise.all([
    baseSelect().where(and(...base, active, sql`${actionsTable.dueDate}::date < ${ukDate}`)).orderBy(asc(actionsTable.dueDate)),
    baseSelect().where(and(...base, active, sql`${actionsTable.dueDate}::date = ${ukDate}`)).orderBy(asc(actionsTable.dueDate)),
    baseSelect().where(and(...base, active, sql`${actionsTable.dueDate}::date > ${ukDate}`,
      sql`${actionsTable.dueDate}::date <= ${ukDate} + 7`)).orderBy(asc(actionsTable.dueDate)),
    baseSelect().where(and(...base, active, or(isNull(actionsTable.dueDate), sql`${actionsTable.dueDate}::date > ${ukDate} + 7`)!))
      .orderBy(asc(actionsTable.dueDate)),
    baseSelect().where(and(...base, eq(actionsTable.status, "completed"),
      sql`${actionsTable.completedAt} >= now() - interval '30 days'`)).orderBy(desc(actionsTable.completedAt)).limit(10),
  ]);
  res.json({ overdue, dueToday, dueThisWeek, later, recentlyCompleted });
});

router.get("/", requireAuth, async (req, res) => {
  const parsed = z.object({
    status: status.optional(), bucket: z.enum(["open", "completed", "closed"]).optional(),
    priority: priority.optional(), assignedUserId: idSchema.optional(), observationId: idSchema.optional(),
    overdue: z.enum(["true", "false"]).optional(), search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const q = parsed.data;
  const conditions = [eq(actionsTable.propertyId, req.authUser!.propertyId!), isNull(actionsTable.deletedAt)];
  if (q.status) conditions.push(eq(actionsTable.status, q.status));
  // "closed" is the accurate name for the combined completed+cancelled bucket;
  // "completed" is kept as a backwards-compatible alias.
  const closedBucket = q.bucket === "completed" || q.bucket === "closed";
  if (closedBucket && q.overdue === "true") {
    return void res.status(400).json({ error: "The overdue filter applies to open tasks only" });
  }
  if (q.bucket === "open") conditions.push(sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`);
  if (closedBucket) conditions.push(sql`${actionsTable.status} IN ('completed', 'cancelled')`);
  if (q.priority) conditions.push(eq(actionsTable.priority, q.priority));
  if (q.assignedUserId) conditions.push(eq(actionsTable.assignedToUserId, q.assignedUserId));
  if (q.observationId) conditions.push(eq(actionsTable.observationId, q.observationId));
  if (q.overdue === "true") conditions.push(sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
    sql`${actionsTable.dueDate}::date < (now() AT TIME ZONE 'Europe/London')::date`);
  if (q.search) conditions.push(or(ilike(actionsTable.referenceNumber, `%${q.search}%`), ilike(actionsTable.title, `%${q.search}%`),
    ilike(actionsTable.description, `%${q.search}%`), ilike(usersTable.name, `%${q.search}%`))!);
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    baseSelect().where(where).orderBy(desc(actionsTable.createdAt), desc(actionsTable.id))
      .limit(q.limit).offset((q.page - 1) * q.limit),
    db.select({ total: count() }).from(actionsTable).leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id)).where(where),
  ]);
  res.json({ actions: rows, total: Number(totals[0]?.total ?? 0), page: q.page, limit: q.limit });
});

router.post("/", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = req.authUser!;
  if (parsed.data.offlineId) {
    const [existing] = await baseSelect().where(and(eq(actionsTable.propertyId, user.propertyId!),
      eq(actionsTable.offlineId, parsed.data.offlineId))).limit(1);
    if (existing) return void res.status(200).setHeader("X-Idempotent-Replay", "true").json(existing);
  }
  if (!(await validateAssignee(user.propertyId!, parsed.data.assignedToUserId))) {
    return void res.status(400).json({ error: "Assignee is not an active user for this estate" });
  }
  if (!(await validateObservation(user.propertyId!, parsed.data.observationId))) {
    return void res.status(400).json({ error: "Observation not found for this estate" });
  }
  if (!(await validateLocation(user.propertyId!, parsed.data.namedLocationId))) {
    return void res.status(400).json({ error: "Location not found for this estate" });
  }
  const referenceNumber = await generateActionRef(user.propertyId!);
  let observationTransition: { applied: boolean; observationStatus: string } | null = null;
  const action = await db.transaction(async (tx) => {
    const [created] = await tx.insert(actionsTable).values({
      propertyId: user.propertyId!, referenceNumber, title: parsed.data.title,
      description: parsed.data.description ?? null, observationId: parsed.data.observationId ?? null,
      namedLocationId: parsed.data.namedLocationId ?? null,
      assignedToUserId: parsed.data.assignedToUserId, createdByUserId: user.id, priority: parsed.data.priority,
      status: parsed.data.status, dueDate: toDueDate(parsed.data.dueDate), estimatedMinutes: parsed.data.estimatedMinutes ?? null,
      equipmentRequired: parsed.data.equipmentRequired, contractorRequired: parsed.data.contractorRequired,
      createdOffline: parsed.data.createdOffline, offlineId: parsed.data.offlineId ?? null,
      syncedAt: parsed.data.createdOffline ? new Date() : null,
      deviceCreatedAt: parsed.data.deviceCreatedAt ? new Date(parsed.data.deviceCreatedAt) : null,
    }).returning();
    if (created.observationId) {
      const [observation] = await tx.select({ status: observationsTable.status }).from(observationsTable)
        .where(eq(observationsTable.id, created.observationId)).limit(1);
      // Only perform the declared-workflow transition. A draft (or any status
      // without a valid path to action_required) is left unchanged; the
      // response reports this so the UI can give clear feedback.
      const canApply = observation ? canTransition(observationTransitions, observation.status as ObservationStatus, "action_required") : false;
      if (observation && observation.status !== "action_required" && !canApply) {
        observationTransition = { applied: false, observationStatus: observation.status };
      }
      if (observation && observation.status !== "action_required" && canApply) {
        observationTransition = { applied: true, observationStatus: "action_required" };
        await tx.update(observationsTable).set({ status: "action_required", updatedAt: new Date() })
          .where(eq(observationsTable.id, created.observationId));
        await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: created.observationId,
          userId: user.id, eventType: "status_changed", fieldName: "status", previousValue: observation.status,
          newValue: "action_required", metadata: { actionId: created.id } });
      }
    }
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: created.observationId,
      actionId: created.id, userId: user.id, eventType: "action_created", newValue: created.title,
      metadata: { offlineId: created.offlineId } });
    if (parsed.data.notes) await tx.insert(notesTable).values({ actionId: created.id, body: parsed.data.notes, createdByUserId: user.id });
    return created;
  }).catch(async (error: unknown) => {
    if (parsed.data.offlineId && isPostgresError(error, "23505")) {
      const [replayed] = await db.select().from(actionsTable).where(and(
        eq(actionsTable.propertyId, user.propertyId!),
        eq(actionsTable.offlineId, parsed.data.offlineId),
      )).limit(1);
      if (replayed) return replayed;
    }
    throw error;
  });
  const [full] = await baseSelect().where(eq(actionsTable.id, action.id)).limit(1);
  const replayed = action.referenceNumber !== referenceNumber;
  if (replayed) res.setHeader("X-Idempotent-Replay", "true");
  res.status(replayed ? 200 : 201).json(replayed ? full : { ...full, observationTransition });
});

router.get("/map", requireAuth, async (req, res) => {
  const query = z.object({
    bucket: z.enum(["open", "completed", "closed"]).optional(), priority: priority.optional(), namedLocationId: idSchema.optional(),
  }).safeParse(req.query);
  if (!query.success) return validationError(res, query.error);
  const q = query.data;
  const actionLoc = alias(namedLocationsTable, "action_loc");
  // Precedence: the task's OWN named location first, then the linked
  // observation's GPS point, then the linked observation's named location.
  const latitude = sql<number>`COALESCE(${actionLoc.latitude}, ${observationsTable.latitude}, ${namedLocationsTable.latitude})`;
  const longitude = sql<number>`COALESCE(${actionLoc.longitude}, ${observationsTable.longitude}, ${namedLocationsTable.longitude})`;
  const conditions = [eq(actionsTable.propertyId, req.authUser!.propertyId!), isNull(actionsTable.deletedAt),
    sql`${latitude} IS NOT NULL`, sql`${longitude} IS NOT NULL`];
  if (q.bucket === "open" || !q.bucket) conditions.push(sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`);
  if (q.bucket === "completed" || q.bucket === "closed") conditions.push(sql`${actionsTable.status} IN ('completed', 'cancelled')`);
  if (q.priority) conditions.push(eq(actionsTable.priority, q.priority));
  if (q.namedLocationId) conditions.push(sql`COALESCE(${actionsTable.namedLocationId}, ${observationsTable.namedLocationId}) = ${q.namedLocationId}`);
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    db.select({
      id: actionsTable.id, title: actionsTable.title, referenceNumber: actionsTable.referenceNumber,
      priority: actionsTable.priority, status: actionsTable.status, latitude, longitude,
      namedLocationName: sql<string | null>`COALESCE(${actionLoc.name}, ${namedLocationsTable.name})`,
      observationId: actionsTable.observationId, dueDate: actionsTable.dueDate,
    })
      .from(actionsTable)
      .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
      .leftJoin(actionLoc, eq(actionsTable.namedLocationId, actionLoc.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(where).orderBy(desc(actionsTable.createdAt)).limit(500),
    db.select({ total: count() }).from(actionsTable)
      .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
      .leftJoin(actionLoc, eq(actionsTable.namedLocationId, actionLoc.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(where),
  ]);
  const total = Number(totals[0]?.total ?? 0);
  res.setHeader("X-Total-Count", String(total));
  res.setHeader("X-Result-Truncated", String(total > rows.length));
  res.json(rows);
});

// Open-task meeting pack: all open tasks (never completed/cancelled), with the
// currently applied list filters, counts and each task's latest note, ordered
// overdue-first, then urgent/high/normal/low, then due date.
router.get("/meeting-pack", requireAuth, async (req, res) => {
  const parsed = z.object({
    priority: priority.optional(), assignedUserId: idSchema.optional(),
    overdue: z.enum(["true", "false"]).optional(), search: z.string().trim().max(200).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const q = parsed.data;
  const conditions = [eq(actionsTable.propertyId, req.authUser!.propertyId!), isNull(actionsTable.deletedAt),
    sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`];
  if (q.priority) conditions.push(eq(actionsTable.priority, q.priority));
  if (q.assignedUserId) conditions.push(eq(actionsTable.assignedToUserId, q.assignedUserId));
  if (q.overdue === "true") conditions.push(sql`${actionsTable.dueDate}::date < (now() AT TIME ZONE 'Europe/London')::date`);
  if (q.search) conditions.push(or(ilike(actionsTable.referenceNumber, `%${q.search}%`), ilike(actionsTable.title, `%${q.search}%`),
    ilike(actionsTable.description, `%${q.search}%`), ilike(usersTable.name, `%${q.search}%`))!);
  const overdueExpr = sql<boolean>`(${actionsTable.dueDate} IS NOT NULL AND ${actionsTable.dueDate}::date < (now() AT TIME ZONE 'Europe/London')::date)`;
  const rows = await db.select({ ...actionFields, isOverdue: overdueExpr,
    latestNote: sql<string | null>`(SELECT n.body FROM notes n WHERE n.action_id = ${actionsTable.id} ORDER BY n.created_at DESC LIMIT 1)` })
    .from(actionsTable)
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    .leftJoin(namedLocationsTable, eq(actionsTable.namedLocationId, namedLocationsTable.id))
    .where(and(...conditions))
    .orderBy(sql`${overdueExpr} DESC`,
      sql`CASE ${actionsTable.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`,
      sql`${actionsTable.dueDate} ASC NULLS LAST`, asc(actionsTable.id))
    .limit(1000);
  const today = new Date();
  const weekAhead = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const counts = {
    total: rows.length,
    urgent: rows.filter((r) => r.priority === "urgent").length,
    high: rows.filter((r) => r.priority === "high").length,
    overdue: rows.filter((r) => r.isOverdue).length,
    dueThisWeek: rows.filter((r) => r.dueDate && !r.isOverdue && String(r.dueDate).slice(0, 10) <= weekAhead).length,
    unassigned: rows.filter((r) => !r.assignedToUserId).length,
  };
  res.json({ generatedAt: new Date().toISOString(), filters: q, counts, tasks: rows });
});

// Archived actions (managers): list + restore.
router.get("/archived", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const propertyId = req.authUser!.propertyId!;
  const rows = await db.select({ ...actionFields, archivedAt: actionsTable.deletedAt }).from(actionsTable)
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    .leftJoin(namedLocationsTable, eq(actionsTable.namedLocationId, namedLocationsTable.id))
    .where(and(eq(actionsTable.propertyId, propertyId), sql`${actionsTable.deletedAt} IS NOT NULL`))
    .orderBy(desc(actionsTable.deletedAt)).limit(200);
  res.json({ actions: rows });
});

router.post("/:id/restore", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
    eq(actionsTable.propertyId, user.propertyId!), sql`${actionsTable.deletedAt} IS NOT NULL`)).limit(1);
  if (!existing) return void res.status(404).json({ error: "Archived action not found" });
  // A task restored under an archived observation would be invisible in normal
  // views; require the parent to be live first.
  if (existing.observationId) {
    const [parent] = await db.select({ deletedAt: observationsTable.deletedAt }).from(observationsTable)
      .where(eq(observationsTable.id, existing.observationId)).limit(1);
    if (parent?.deletedAt) return void res.status(409).json({ error: "Restore the linked observation first" });
  }
  await db.transaction(async (tx) => {
    await tx.update(actionsTable).set({ deletedAt: null, deletedByUserId: null, updatedAt: new Date() })
      .where(eq(actionsTable.id, id.data));
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, actionId: id.data, observationId: existing.observationId,
      userId: user.id, eventType: "action_restored", newValue: existing.title });
  });
  res.json({ restored: true });
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const propertyId = req.authUser!.propertyId!;
  const [action] = await baseSelect().where(and(eq(actionsTable.id, id.data), eq(actionsTable.propertyId, propertyId),
    isNull(actionsTable.deletedAt))).limit(1);
  if (!action) return void res.status(404).json({ error: "Action not found" });
  const [notes, auditEvents] = await Promise.all([
    db.select({ id: notesTable.id, body: notesTable.body, observationId: notesTable.observationId, actionId: notesTable.actionId,
      createdByUserId: notesTable.createdByUserId, createdByName: usersTable.name, createdAt: notesTable.createdAt })
      .from(notesTable).leftJoin(usersTable, eq(notesTable.createdByUserId, usersTable.id))
      .where(eq(notesTable.actionId, id.data)).orderBy(asc(notesTable.createdAt)),
    db.select({ id: auditEventsTable.id, eventType: auditEventsTable.eventType, fieldName: auditEventsTable.fieldName,
      previousValue: auditEventsTable.previousValue, newValue: auditEventsTable.newValue, userId: auditEventsTable.userId,
      userName: usersTable.name, createdAt: auditEventsTable.createdAt })
      .from(auditEventsTable).leftJoin(usersTable, eq(auditEventsTable.userId, usersTable.id))
      .where(and(eq(auditEventsTable.actionId, id.data), eq(auditEventsTable.propertyId, propertyId)))
      .orderBy(desc(auditEventsTable.createdAt)).limit(100),
  ]);
  res.json({ ...action, notes, auditEvents });
});

router.patch("/:id", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
    eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Action not found" });
  if (parsed.data.assignedToUserId && !(await validateAssignee(user.propertyId!, parsed.data.assignedToUserId))) {
    return void res.status(400).json({ error: "Assignee is not an active user for this estate" });
  }
  if (parsed.data.observationId !== undefined && !(await validateObservation(user.propertyId!, parsed.data.observationId))) {
    return void res.status(400).json({ error: "Observation not found for this estate" });
  }
  if (parsed.data.namedLocationId !== undefined && !(await validateLocation(user.propertyId!, parsed.data.namedLocationId))) {
    return void res.status(400).json({ error: "Location not found for this estate" });
  }
  const { expectedUpdatedAt, ...fields } = parsed.data;
  if (expectedUpdatedAt !== undefined && existing.updatedAt.toISOString() !== expectedUpdatedAt) {
    return void res.status(409).json({
      error: "This task was changed by someone else while you were editing. Reload to see the latest version, then reapply your changes.",
      code: "edit_conflict", currentUpdatedAt: existing.updatedAt.toISOString(),
    });
  }
  const updates: Record<string, unknown> = { ...fields, updatedAt: new Date() };
  if (fields.dueDate !== undefined) updates.dueDate = toDueDate(fields.dueDate);
  const changes = Object.entries(fields).filter(([key, value]) => JSON.stringify(existing[key as keyof typeof existing]) !== JSON.stringify(value));
  // Compare-and-swap: when a token is supplied the UPDATE itself is conditional
  // on updatedAt, so two concurrent editors cannot both succeed.
  const updateCondition = expectedUpdatedAt !== undefined
    ? and(eq(actionsTable.id, id.data), eq(actionsTable.updatedAt, new Date(expectedUpdatedAt)))
    : eq(actionsTable.id, id.data);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(actionsTable).set(updates).where(updateCondition).returning();
    if (!row) return undefined;
    if (changes.length) await tx.insert(auditEventsTable).values(changes.map(([fieldName, value]) => ({
      propertyId: user.propertyId!, actionId: id.data, observationId: row.observationId, userId: user.id,
      eventType: "action_edited", fieldName, previousValue: String(existing[fieldName as keyof typeof existing] ?? ""),
      newValue: String(value ?? ""),
    })));
    return row;
  });
  if (!updated) {
    // Lost the race between our read and the conditional update.
    const [current] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
      eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
    if (!current) return void res.status(404).json({ error: "Action not found" });
    return void res.status(409).json({
      error: "This task was changed by someone else while you were editing. Reload to see the latest version, then reapply your changes.",
      code: "edit_conflict", currentUpdatedAt: current.updatedAt.toISOString(),
    });
  }
  const [full] = await baseSelect().where(eq(actionsTable.id, updated.id)).limit(1);
  res.json(full);
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = z.object({ status, completionNote: optionalText(5000), waitingReason: optionalText(2000),
    cancellationReason: optionalText(2000) }).strict().safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
    eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Action not found" });
  if (!canUpdateAction(user, existing.assignedToUserId)) return void res.status(403).json({ error: "Only the assignee or a manager may update this action" });
  if (existing.status === parsed.data.status) {
    const [full] = await baseSelect().where(eq(actionsTable.id, existing.id)).limit(1);
    res.setHeader("X-Idempotent-Replay", "true");
    return void res.json(full);
  }
  if (["completed", "cancelled"].includes(existing.status) && !isManager(user)) {
    return void res.status(403).json({ error: "Only a manager may reopen a completed or cancelled action" });
  }
  if (!canTransition(actionTransitions, existing.status, parsed.data.status)) {
    return void res.status(409).json({ error: `Cannot move an action from ${existing.status} to ${parsed.data.status}` });
  }
  if (parsed.data.status === "completed" && !parsed.data.completionNote) return void res.status(400).json({ error: "A completion note is required" });
  if (parsed.data.status === "waiting" && !parsed.data.waitingReason) return void res.status(400).json({ error: "A waiting reason is required" });
  if (parsed.data.status === "cancelled" && !parsed.data.cancellationReason) return void res.status(400).json({ error: "A cancellation reason is required" });
  const updates = {
    status: parsed.data.status, updatedAt: new Date(),
    completedAt: parsed.data.status === "completed" ? new Date() : null,
    completionNote: parsed.data.status === "completed" ? parsed.data.completionNote ?? null : null,
    waitingReason: parsed.data.status === "waiting" ? parsed.data.waitingReason ?? null : null,
    cancellationReason: parsed.data.status === "cancelled" ? parsed.data.cancellationReason ?? null : null,
  };
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(actionsTable).set(updates).where(eq(actionsTable.id, id.data)).returning();
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, actionId: id.data, observationId: row.observationId,
      userId: user.id, eventType: "status_changed", fieldName: "status", previousValue: existing.status,
      newValue: parsed.data.status, metadata: { completionNote: parsed.data.completionNote, waitingReason: parsed.data.waitingReason,
        cancellationReason: parsed.data.cancellationReason } });
    return row;
  });
  const [full] = await baseSelect().where(eq(actionsTable.id, updated.id)).limit(1);
  res.json(full);
});

router.delete("/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
    eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Action not found" });
  await db.transaction(async (tx) => {
    await tx.update(actionsTable).set({ deletedAt: new Date(), deletedByUserId: user.id, updatedAt: new Date() })
      .where(eq(actionsTable.id, id.data));
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, actionId: id.data, observationId: existing.observationId,
      userId: user.id, eventType: "action_archived", previousValue: existing.title });
  });
  res.status(204).send();
});

export default router;
