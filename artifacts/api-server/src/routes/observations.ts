import { Router } from "express";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  actionsTable, auditEventsTable, categoriesTable, db, namedLocationsTable, notesTable, observationsTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { generateObservationRef } from "../lib/references";
import { idSchema, isPostgresError, optionalText, shortText, validationError } from "../lib/validation";
import { canTransition, observationStatuses, observationTransitions } from "../lib/workflows";

const router = Router();
const priority = z.enum(["low", "normal", "high", "urgent"]);
const status = z.enum(observationStatuses);
const observationBase = z.object({
  title: shortText,
  description: optionalText(10000),
  categoryId: z.number().int().positive(),
  priority,
  status: z.enum(["draft", "submitted"]).default("submitted"),
  observedAt: z.string().datetime({ offset: true }),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  gpsAccuracyMetres: z.number().nonnegative().max(100000).optional().nullable(),
  namedLocationId: z.number().int().positive().optional().nullable(),
  safetyIssue: z.boolean().default(false), publicAccessAffected: z.boolean().default(false),
  machineryRequired: z.boolean().default(false), specialistRequired: z.boolean().default(false),
  followUpRequired: z.boolean().default(false), createdOffline: z.boolean().default(false),
  offlineId: z.string().uuid().optional().nullable(),
}).strict();
const createSchema = observationBase.refine((value) => (value.latitude == null) === (value.longitude == null), {
  message: "Latitude and longitude must be supplied together",
});
const updateSchema = observationBase.omit({ status: true, createdOffline: true, offlineId: true }).partial().strict()
  .refine((value) => {
    if (value.latitude === undefined && value.longitude === undefined) return true;
    return (value.latitude == null) === (value.longitude == null);
  }, { message: "Latitude and longitude must be supplied together" });

const observationFields = {
  id: observationsTable.id, referenceNumber: observationsTable.referenceNumber, title: observationsTable.title,
  description: observationsTable.description, categoryId: observationsTable.categoryId, categoryName: categoriesTable.name,
  categoryColour: categoriesTable.displayColour, priority: observationsTable.priority, status: observationsTable.status,
  observedAt: observationsTable.observedAt, reportedByUserId: observationsTable.reportedByUserId, reportedByName: usersTable.name,
  latitude: observationsTable.latitude, longitude: observationsTable.longitude, gpsAccuracyMetres: observationsTable.gpsAccuracyMetres,
  namedLocationId: observationsTable.namedLocationId, namedLocationName: namedLocationsTable.name,
  safetyIssue: observationsTable.safetyIssue, publicAccessAffected: observationsTable.publicAccessAffected,
  machineryRequired: observationsTable.machineryRequired, specialistRequired: observationsTable.specialistRequired,
  followUpRequired: observationsTable.followUpRequired, propertyId: observationsTable.propertyId,
  createdAt: observationsTable.createdAt, updatedAt: observationsTable.updatedAt,
};

async function validateRelations(propertyId: number, categoryId?: number | null, locationId?: number | null) {
  if (categoryId !== undefined && categoryId !== null) {
    const [row] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.propertyId, propertyId), eq(categoriesTable.active, true))).limit(1);
    if (!row) return "Category not found for this estate";
  }
  if (locationId !== undefined && locationId !== null) {
    const [row] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(and(eq(namedLocationsTable.id, locationId), eq(namedLocationsTable.propertyId, propertyId), eq(namedLocationsTable.active, true))).limit(1);
    if (!row) return "Location not found for this estate";
  }
  return null;
}

router.get("/", requireAuth, async (req, res) => {
  const query = z.object({
    status: status.optional(), priority: priority.optional(), categoryId: idSchema.optional(), namedLocationId: idSchema.optional(),
    safetyIssue: z.enum(["true", "false"]).optional(), publicAccessAffected: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(200).optional(), dateFrom: z.string().date().optional(), dateTo: z.string().date().optional(),
    page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  }).safeParse(req.query);
  if (!query.success) return validationError(res, query.error);
  const q = query.data;
  const conditions = [eq(observationsTable.propertyId, req.authUser!.propertyId!), isNull(observationsTable.deletedAt)];
  if (q.status) conditions.push(eq(observationsTable.status, q.status));
  if (q.priority) conditions.push(eq(observationsTable.priority, q.priority));
  if (q.categoryId) conditions.push(eq(observationsTable.categoryId, q.categoryId));
  if (q.namedLocationId) conditions.push(eq(observationsTable.namedLocationId, q.namedLocationId));
  if (q.safetyIssue) conditions.push(eq(observationsTable.safetyIssue, q.safetyIssue === "true"));
  if (q.publicAccessAffected) conditions.push(eq(observationsTable.publicAccessAffected, q.publicAccessAffected === "true"));
  if (q.dateFrom) conditions.push(sql`${observationsTable.observedAt} >= ${q.dateFrom}::date`);
  if (q.dateTo) conditions.push(sql`${observationsTable.observedAt} < (${q.dateTo}::date + interval '1 day')`);
  if (q.search) conditions.push(or(ilike(observationsTable.referenceNumber, `%${q.search}%`), ilike(observationsTable.title, `%${q.search}%`),
    ilike(observationsTable.description, `%${q.search}%`), ilike(namedLocationsTable.name, `%${q.search}%`))!);
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    db.select(observationFields).from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
      .where(where).orderBy(desc(observationsTable.createdAt), desc(observationsTable.id))
      .limit(q.limit).offset((q.page - 1) * q.limit),
    db.select({ total: count() }).from(observationsTable)
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id)).where(where),
  ]);
  const ids = rows.map((row) => row.id);
  const counts = ids.length ? await db.select({ observationId: actionsTable.observationId, value: count() }).from(actionsTable)
    .where(and(inArray(actionsTable.observationId, ids), isNull(actionsTable.deletedAt))).groupBy(actionsTable.observationId) : [];
  const actionCounts = new Map(counts.map((item) => [item.observationId, Number(item.value)]));
  res.json({ observations: rows.map((row) => ({ ...row, actionCount: actionCounts.get(row.id) ?? 0 })),
    total: Number(totals[0]?.total ?? 0), page: q.page, limit: q.limit });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = req.authUser!;
  const relationError = await validateRelations(user.propertyId!, parsed.data.categoryId, parsed.data.namedLocationId);
  if (relationError) return void res.status(400).json({ error: relationError });
  if (parsed.data.offlineId) {
    const [existing] = await db.select().from(observationsTable).where(and(eq(observationsTable.propertyId, user.propertyId!),
      eq(observationsTable.offlineId, parsed.data.offlineId))).limit(1);
    if (existing) return void res.status(200).setHeader("X-Idempotent-Replay", "true").json({ ...existing, actionCount: 0 });
  }
  const referenceNumber = await generateObservationRef(user.propertyId!);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(observationsTable).values({
      ...parsed.data, description: parsed.data.description ?? null, namedLocationId: parsed.data.namedLocationId ?? null,
      latitude: parsed.data.latitude ?? null, longitude: parsed.data.longitude ?? null,
      gpsAccuracyMetres: parsed.data.gpsAccuracyMetres ?? null, offlineId: parsed.data.offlineId ?? null,
      syncedAt: parsed.data.createdOffline ? new Date() : null, observedAt: new Date(parsed.data.observedAt),
      propertyId: user.propertyId!, referenceNumber, reportedByUserId: user.id,
    }).returning();
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: row.id, userId: user.id,
      eventType: "observation_created", newValue: row.title, metadata: { offlineId: row.offlineId } });
    return row;
  }).catch(async (error: unknown) => {
    if (parsed.data.offlineId && isPostgresError(error, "23505")) {
      const [replayed] = await db.select().from(observationsTable).where(and(
        eq(observationsTable.propertyId, user.propertyId!),
        eq(observationsTable.offlineId, parsed.data.offlineId),
      )).limit(1);
      if (replayed) return replayed;
    }
    throw error;
  });
  const replayed = created.referenceNumber !== referenceNumber;
  if (replayed) res.setHeader("X-Idempotent-Replay", "true");
  res.status(replayed ? 200 : 201).json({ ...created, actionCount: 0 });
});

router.get("/map", requireAuth, async (req, res) => {
  const query = z.object({ status: status.optional(), priority: priority.optional(), categoryId: idSchema.optional(),
    namedLocationId: idSchema.optional(), safetyIssue: z.enum(["true", "false"]).optional() }).safeParse(req.query);
  if (!query.success) return validationError(res, query.error);
  // Observations plot at their direct GPS point when present, otherwise at
  // their named location's coordinates.
  const mapLatitude = sql<number>`COALESCE(${observationsTable.latitude}, ${namedLocationsTable.latitude})`;
  const mapLongitude = sql<number>`COALESCE(${observationsTable.longitude}, ${namedLocationsTable.longitude})`;
  const conditions = [eq(observationsTable.propertyId, req.authUser!.propertyId!), isNull(observationsTable.deletedAt),
    sql`${mapLatitude} IS NOT NULL`, sql`${mapLongitude} IS NOT NULL`];
  const q = query.data;
  if (q.status) conditions.push(eq(observationsTable.status, q.status));
  if (q.priority) conditions.push(eq(observationsTable.priority, q.priority));
  if (q.categoryId) conditions.push(eq(observationsTable.categoryId, q.categoryId));
  if (q.namedLocationId) conditions.push(eq(observationsTable.namedLocationId, q.namedLocationId));
  if (q.safetyIssue) conditions.push(eq(observationsTable.safetyIssue, q.safetyIssue === "true"));
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    db.select({ id: observationsTable.id, title: observationsTable.title, referenceNumber: observationsTable.referenceNumber,
      priority: observationsTable.priority, status: observationsTable.status, latitude: mapLatitude,
      longitude: mapLongitude, categoryName: categoriesTable.name, categoryColour: categoriesTable.displayColour,
      namedLocationName: namedLocationsTable.name, safetyIssue: observationsTable.safetyIssue })
      .from(observationsTable).leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(where).orderBy(desc(observationsTable.createdAt)).limit(500),
    db.select({ total: count() }).from(observationsTable)
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id)).where(where),
  ]);
  const total = Number(totals[0]?.total ?? 0);
  res.setHeader("X-Total-Count", String(total));
  res.setHeader("X-Result-Truncated", String(total > rows.length));
  res.json(rows);
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const propertyId = req.authUser!.propertyId!;
  const [observation] = await db.select(observationFields).from(observationsTable)
    .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
    .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
    .where(and(eq(observationsTable.id, id.data), eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt))).limit(1);
  if (!observation) return void res.status(404).json({ error: "Observation not found" });
  const [actions, notes, auditEvents] = await Promise.all([
    db.select({ id: actionsTable.id, referenceNumber: actionsTable.referenceNumber, title: actionsTable.title,
      description: actionsTable.description, observationId: actionsTable.observationId, assignedToUserId: actionsTable.assignedToUserId,
      assignedToName: usersTable.name, createdByUserId: actionsTable.createdByUserId, priority: actionsTable.priority,
      status: actionsTable.status, dueDate: actionsTable.dueDate, completedAt: actionsTable.completedAt,
      completionNote: actionsTable.completionNote, equipmentRequired: actionsTable.equipmentRequired,
      contractorRequired: actionsTable.contractorRequired, propertyId: actionsTable.propertyId,
      createdAt: actionsTable.createdAt, updatedAt: actionsTable.updatedAt })
      .from(actionsTable).leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
      .where(and(eq(actionsTable.observationId, id.data), eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt)))
      .orderBy(asc(actionsTable.createdAt)),
    db.select({ id: notesTable.id, body: notesTable.body, observationId: notesTable.observationId, actionId: notesTable.actionId,
      createdByUserId: notesTable.createdByUserId, createdByName: usersTable.name, createdAt: notesTable.createdAt })
      .from(notesTable).leftJoin(usersTable, eq(notesTable.createdByUserId, usersTable.id))
      .where(eq(notesTable.observationId, id.data)).orderBy(asc(notesTable.createdAt)),
    db.select({ id: auditEventsTable.id, eventType: auditEventsTable.eventType, fieldName: auditEventsTable.fieldName,
      previousValue: auditEventsTable.previousValue, newValue: auditEventsTable.newValue, userId: auditEventsTable.userId,
      userName: usersTable.name, createdAt: auditEventsTable.createdAt })
      .from(auditEventsTable).leftJoin(usersTable, eq(auditEventsTable.userId, usersTable.id))
      .where(and(eq(auditEventsTable.observationId, id.data), eq(auditEventsTable.propertyId, propertyId)))
      .orderBy(desc(auditEventsTable.createdAt)).limit(100),
  ]);
  res.json({ ...observation, actions, notes, auditEvents });
});

router.patch("/:id", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(observationsTable).where(and(eq(observationsTable.id, id.data),
    eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Observation not found" });
  const relationError = await validateRelations(
    user.propertyId!,
    parsed.data.categoryId === undefined || parsed.data.categoryId === existing.categoryId ? undefined : parsed.data.categoryId,
    parsed.data.namedLocationId === undefined || parsed.data.namedLocationId === existing.namedLocationId ? undefined : parsed.data.namedLocationId,
  );
  if (relationError) return void res.status(400).json({ error: relationError });
  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.observedAt) updates.observedAt = new Date(parsed.data.observedAt);
  const changes = Object.entries(parsed.data).filter(([key, value]) => JSON.stringify(existing[key as keyof typeof existing]) !== JSON.stringify(value));
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(observationsTable).set(updates).where(eq(observationsTable.id, id.data)).returning();
    if (changes.length) await tx.insert(auditEventsTable).values(changes.map(([fieldName, value]) => ({
      propertyId: user.propertyId!, observationId: id.data, userId: user.id, eventType: "observation_edited", fieldName,
      previousValue: String(existing[fieldName as keyof typeof existing] ?? ""), newValue: String(value ?? ""),
    })));
    return updated;
  });
  res.json(row);
});

router.patch("/:id/status", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = z.object({ status, reason: z.string().trim().min(3).max(2000).optional() }).strict().safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(observationsTable).where(and(eq(observationsTable.id, id.data),
    eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Observation not found" });
  if (existing.status === parsed.data.status) {
    res.setHeader("X-Idempotent-Replay", "true");
    return void res.json(existing);
  }
  if (!canTransition(observationTransitions, existing.status, parsed.data.status)) {
    return void res.status(409).json({ error: `Cannot move an observation from ${existing.status} to ${parsed.data.status}` });
  }
  const updates: Record<string, unknown> = { status: parsed.data.status, updatedAt: new Date(),
    resolvedAt: parsed.data.status === "resolved" ? new Date() : null, closedAt: parsed.data.status === "closed" ? new Date() : null };
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(observationsTable).set(updates).where(eq(observationsTable.id, id.data)).returning();
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: id.data, userId: user.id,
      eventType: "status_changed", fieldName: "status", previousValue: existing.status, newValue: parsed.data.status,
      metadata: parsed.data.reason ? { reason: parsed.data.reason } : undefined });
    return updated;
  });
  res.json(row);
});

router.delete("/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const user = req.authUser!;
  const [existing] = await db.select().from(observationsTable).where(and(eq(observationsTable.id, id.data),
    eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt))).limit(1);
  if (!existing) return void res.status(404).json({ error: "Observation not found" });
  await db.transaction(async (tx) => {
    await tx.update(observationsTable).set({ deletedAt: new Date(), deletedByUserId: user.id, updatedAt: new Date() })
      .where(eq(observationsTable.id, id.data));
    await tx.update(actionsTable).set({ deletedAt: new Date(), deletedByUserId: user.id, updatedAt: new Date() })
      .where(and(eq(actionsTable.observationId, id.data), isNull(actionsTable.deletedAt)));
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: id.data, userId: user.id,
      eventType: "observation_archived", previousValue: existing.title });
  });
  res.status(204).send();
});

export default router;
