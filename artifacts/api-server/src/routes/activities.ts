import { Router } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db, activityTypesTable, activityLogsTable, activityLogParticipantsTable,
  namedLocationsTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { idSchema, optionalText, shortText, validationError } from "../lib/validation";

const router = Router();

const DEFAULT_ACTIVITY_TYPES = [
  "Strimming", "Mowing", "Hedge cutting", "Tree work", "Fencing",
  "Path maintenance", "Litter picking", "Planting", "Watering",
  "Machinery maintenance", "Patrol / inspection", "Visitor support", "Other",
];

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

const activityDateSchema = dateSchema.refine((value) => {
  // Allow up to one day ahead to tolerate timezone differences between client and server.
  const limit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return value <= limit;
}, "Activity date cannot be in the future");

const createSchema = z.object({
  activityTypeId: z.number().int().positive(),
  namedLocationId: z.number().int().positive().optional().nullable(),
  activityDate: activityDateSchema,
  durationMinutes: z.number().int().min(5).max(1440),
  participantUserIds: z.array(z.number().int().positive()).max(50).default([]),
  notes: optionalText(2000),
}).strict();

const listQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

async function ensureDefaultTypes(propertyId: number): Promise<void> {
  // Idempotent: unique(property_id, name) means existing (even deactivated) defaults are left untouched.
  await db.insert(activityTypesTable)
    .values(DEFAULT_ACTIVITY_TYPES.map((name, index) => ({ propertyId, name, sortOrder: index })))
    .onConflictDoNothing();
}

router.get("/activity-types", requireAuth, async (req, res) => {
  const propertyId = req.authUser!.propertyId!;
  await ensureDefaultTypes(propertyId);
  const rows = await db.select().from(activityTypesTable)
    .where(and(eq(activityTypesTable.propertyId, propertyId), eq(activityTypesTable.active, true)))
    .orderBy(asc(activityTypesTable.sortOrder), asc(activityTypesTable.name));
  res.json(rows);
});

router.post("/activity-types", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = z.object({ name: shortText }).strict().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const [duplicate] = await db.select({ id: activityTypesTable.id }).from(activityTypesTable)
    .where(and(eq(activityTypesTable.propertyId, propertyId), eq(activityTypesTable.name, parsed.data.name))).limit(1);
  if (duplicate) return void res.status(409).json({ error: "An activity type with this name already exists" });
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${activityTypesTable.sortOrder}), 0)` })
    .from(activityTypesTable).where(eq(activityTypesTable.propertyId, propertyId));
  const [row] = await db.insert(activityTypesTable)
    .values({ propertyId, name: parsed.data.name, sortOrder: Number(max) + 1 }).returning();
  res.status(201).json(row);
});

async function loadParticipants(activityLogIds: number[]) {
  if (activityLogIds.length === 0) return new Map<number, { id: number; name: string }[]>();
  const rows = await db.select({
    activityLogId: activityLogParticipantsTable.activityLogId,
    id: usersTable.id, name: usersTable.name,
  }).from(activityLogParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, activityLogParticipantsTable.userId))
    .where(inArray(activityLogParticipantsTable.activityLogId, activityLogIds))
    .orderBy(asc(usersTable.name));
  const map = new Map<number, { id: number; name: string }[]>();
  for (const row of rows) {
    const list = map.get(row.activityLogId) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.activityLogId, list);
  }
  return map;
}

const recordedBy = usersTable;

router.get("/activities", requireAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const { from, to, page, limit } = parsed.data;
  const propertyId = req.authUser!.propertyId!;
  const conditions = [
    eq(activityLogsTable.propertyId, propertyId),
    isNull(activityLogsTable.deletedAt),
    ...(from ? [gte(activityLogsTable.activityDate, from)] : []),
    ...(to ? [lte(activityLogsTable.activityDate, to)] : []),
  ];
  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: activityLogsTable.id,
      activityTypeId: activityLogsTable.activityTypeId,
      activityTypeName: activityTypesTable.name,
      namedLocationId: activityLogsTable.namedLocationId,
      namedLocationName: namedLocationsTable.name,
      activityDate: activityLogsTable.activityDate,
      durationMinutes: activityLogsTable.durationMinutes,
      notes: activityLogsTable.notes,
      recordedByUserId: activityLogsTable.recordedByUserId,
      recordedByName: recordedBy.name,
      createdAt: activityLogsTable.createdAt,
    }).from(activityLogsTable)
      .innerJoin(activityTypesTable, eq(activityTypesTable.id, activityLogsTable.activityTypeId))
      .leftJoin(namedLocationsTable, eq(namedLocationsTable.id, activityLogsTable.namedLocationId))
      .innerJoin(recordedBy, eq(recordedBy.id, activityLogsTable.recordedByUserId))
      .where(where)
      .orderBy(desc(activityLogsTable.activityDate), desc(activityLogsTable.createdAt))
      .limit(limit).offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)` }).from(activityLogsTable).where(where),
  ]);
  const participants = await loadParticipants(rows.map((r) => r.id));
  res.json({
    activities: rows.map((row) => ({ ...row, participants: participants.get(row.id) ?? [] })),
    total: Number(total), page, limit,
  });
});

router.post("/activities", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const { activityTypeId, namedLocationId, activityDate, durationMinutes, participantUserIds, notes } = parsed.data;

  const [type] = await db.select({ id: activityTypesTable.id }).from(activityTypesTable)
    .where(and(eq(activityTypesTable.id, activityTypeId), eq(activityTypesTable.propertyId, propertyId), eq(activityTypesTable.active, true))).limit(1);
  if (!type) return void res.status(400).json({ error: "Unknown activity type" });

  if (namedLocationId != null) {
    const [location] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(and(eq(namedLocationsTable.id, namedLocationId), eq(namedLocationsTable.propertyId, propertyId))).limit(1);
    if (!location) return void res.status(400).json({ error: "Unknown location" });
  }

  const uniqueParticipants = [...new Set(participantUserIds)];
  if (uniqueParticipants.length > 0) {
    const found = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(inArray(usersTable.id, uniqueParticipants), eq(usersTable.propertyId, propertyId), eq(usersTable.active, true)));
    if (found.length !== uniqueParticipants.length) return void res.status(400).json({ error: "Unknown participant" });
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(activityLogsTable).values({
      propertyId, activityTypeId, namedLocationId: namedLocationId ?? null,
      activityDate, durationMinutes, notes: notes ?? null,
      recordedByUserId: req.authUser!.id,
    }).returning();
    if (uniqueParticipants.length > 0) {
      await tx.insert(activityLogParticipantsTable)
        .values(uniqueParticipants.map((userId) => ({ activityLogId: row.id, userId })));
    }
    return row;
  });
  res.status(201).json({ id: created.id });
});

router.delete("/activities/:id", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const propertyId = req.authUser!.propertyId!;
  const [row] = await db.select({ id: activityLogsTable.id, recordedByUserId: activityLogsTable.recordedByUserId })
    .from(activityLogsTable)
    .where(and(eq(activityLogsTable.id, id.data), eq(activityLogsTable.propertyId, propertyId), isNull(activityLogsTable.deletedAt))).limit(1);
  if (!row) return void res.status(404).json({ error: "Activity not found" });
  const user = req.authUser!;
  const allowed = user.role === "administrator" || user.role === "manager" || row.recordedByUserId === user.id;
  if (!allowed) return void res.status(403).json({ error: "You can only delete your own activities" });
  await db.update(activityLogsTable)
    .set({ deletedAt: new Date(), deletedByUserId: user.id })
    .where(eq(activityLogsTable.id, id.data));
  res.status(204).end();
});

export default router;
