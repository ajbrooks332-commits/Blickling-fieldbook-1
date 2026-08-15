import { Router } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db, activityTypesTable, activityLogsTable, activityLogParticipantsTable,
  activityLogLocationsTable, namedLocationsTable, usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { idSchema, optionalText, shortText, validationError } from "../lib/validation";

const router = Router();

const DEFAULT_ACTIVITY_TYPES: { name: string; category: string }[] = [
  { name: "Strimming", category: "Grassland management" },
  { name: "Mowing", category: "Grassland management" },
  { name: "Hedge cutting", category: "Hedgerow management" },
  { name: "Tree work", category: "Tree safety" },
  { name: "Chipping", category: "Woodland management" },
  { name: "Fencing", category: "Estate maintenance" },
  { name: "Path maintenance", category: "Access & paths" },
  { name: "Litter picking", category: "Visitor & site care" },
  { name: "Planting", category: "Planting & establishment" },
  { name: "Watering", category: "Planting & establishment" },
  { name: "Machinery maintenance", category: "Machinery & equipment" },
  { name: "Patrol / inspection", category: "Patrols & inspections" },
  { name: "Visitor support", category: "Visitor & site care" },
  { name: "Other", category: "Other" },
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
  namedLocationIds: z.array(z.number().int().positive()).max(20).default([]),
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
    .values(DEFAULT_ACTIVITY_TYPES.map(({ name, category }, index) => ({ propertyId, name, category, sortOrder: index })))
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

// Any signed-in user may add a custom activity type (typed in from the quick-add form).
router.post("/activity-types", requireAuth, async (req, res) => {
  const parsed = z.object({ name: shortText, category: shortText.optional() }).strict().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const name = parsed.data.name.trim();
  if (!name) return void res.status(400).json({ error: "Activity name is required" });
  const findExisting = async () => {
    const [row] = await db.select().from(activityTypesTable)
      .where(and(eq(activityTypesTable.propertyId, propertyId), sql`lower(${activityTypesTable.name}) = lower(${name})`)).limit(1);
    return row;
  };
  let existing = await findExisting();
  if (!existing) {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${activityTypesTable.sortOrder}), 0)` })
      .from(activityTypesTable).where(eq(activityTypesTable.propertyId, propertyId));
    // Case-insensitive uniqueness is enforced by a DB index; ON CONFLICT DO NOTHING
    // makes concurrent same-name requests safe — the loser falls through to reuse.
    const [inserted] = await db.insert(activityTypesTable)
      .values({ propertyId, name, category: parsed.data.category?.trim() || "Other", sortOrder: Number(max) + 1 })
      .onConflictDoNothing().returning();
    if (inserted) return void res.status(201).json(inserted);
    existing = await findExisting();
    if (!existing) return void res.status(500).json({ error: "Could not create activity type" });
  }
  // Reuse (and reactivate) an existing type of the same name instead of rejecting —
  // the quick-add flow just needs a usable type back.
  if (!existing.active) {
    const [reactivated] = await db.update(activityTypesTable).set({ active: true })
      .where(eq(activityTypesTable.id, existing.id)).returning();
    return void res.status(200).json(reactivated);
  }
  res.status(200).json(existing);
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

async function loadLocations(activityLogIds: number[]) {
  if (activityLogIds.length === 0) return new Map<number, { id: number; name: string }[]>();
  const rows = await db.select({
    activityLogId: activityLogLocationsTable.activityLogId,
    id: namedLocationsTable.id, name: namedLocationsTable.name,
  }).from(activityLogLocationsTable)
    .innerJoin(namedLocationsTable, eq(namedLocationsTable.id, activityLogLocationsTable.namedLocationId))
    .where(inArray(activityLogLocationsTable.activityLogId, activityLogIds))
    .orderBy(asc(namedLocationsTable.name));
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
      activityCategory: activityTypesTable.category,
      activityDate: activityLogsTable.activityDate,
      durationMinutes: activityLogsTable.durationMinutes,
      notes: activityLogsTable.notes,
      recordedByUserId: activityLogsTable.recordedByUserId,
      recordedByName: recordedBy.name,
      createdAt: activityLogsTable.createdAt,
    }).from(activityLogsTable)
      .innerJoin(activityTypesTable, eq(activityTypesTable.id, activityLogsTable.activityTypeId))
      .innerJoin(recordedBy, eq(recordedBy.id, activityLogsTable.recordedByUserId))
      .where(where)
      .orderBy(desc(activityLogsTable.activityDate), desc(activityLogsTable.createdAt))
      .limit(limit).offset((page - 1) * limit),
    db.select({ total: sql<number>`count(*)` }).from(activityLogsTable).where(where),
  ]);
  const ids = rows.map((r) => r.id);
  const [participants, locationMap] = await Promise.all([loadParticipants(ids), loadLocations(ids)]);
  res.json({
    activities: rows.map((row) => ({
      ...row,
      participants: participants.get(row.id) ?? [],
      locations: locationMap.get(row.id) ?? [],
    })),
    total: Number(total), page, limit,
  });
});

// Summary report: hours by activity type and by broad category, for export/visualisation.
router.get("/activities/report", requireAuth, async (req, res) => {
  const parsed = z.object({ from: dateSchema.optional(), to: dateSchema.optional() }).strict().safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const { from, to } = parsed.data;
  const propertyId = req.authUser!.propertyId!;
  const where = and(
    eq(activityLogsTable.propertyId, propertyId),
    isNull(activityLogsTable.deletedAt),
    ...(from ? [gte(activityLogsTable.activityDate, from)] : []),
    ...(to ? [lte(activityLogsTable.activityDate, to)] : []),
  );
  const byType = await db.select({
    activityTypeId: activityTypesTable.id,
    name: activityTypesTable.name,
    category: sql<string>`coalesce(${activityTypesTable.category}, 'Other')`,
    minutes: sql<number>`sum(${activityLogsTable.durationMinutes})`,
    count: sql<number>`count(*)`,
  }).from(activityLogsTable)
    .innerJoin(activityTypesTable, eq(activityTypesTable.id, activityLogsTable.activityTypeId))
    .where(where)
    .groupBy(activityTypesTable.id, activityTypesTable.name, activityTypesTable.category)
    .orderBy(desc(sql`sum(${activityLogsTable.durationMinutes})`));
  const categoryTotals = new Map<string, { minutes: number; count: number }>();
  let totalMinutes = 0, totalCount = 0;
  const typeRows = byType.map((r) => {
    const minutes = Number(r.minutes), count = Number(r.count);
    totalMinutes += minutes; totalCount += count;
    const cat = categoryTotals.get(r.category) ?? { minutes: 0, count: 0 };
    cat.minutes += minutes; cat.count += count;
    categoryTotals.set(r.category, cat);
    return { activityTypeId: r.activityTypeId, name: r.name, category: r.category, minutes, count };
  });
  const byCategory = [...categoryTotals.entries()]
    .map(([category, t]) => ({ category, minutes: t.minutes, count: t.count }))
    .sort((a, b) => b.minutes - a.minutes);
  res.json({ totalMinutes, totalCount, byType: typeRows, byCategory });
});

router.post("/activities", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const { activityTypeId, namedLocationIds, activityDate, durationMinutes, participantUserIds, notes } = parsed.data;

  const [type] = await db.select({ id: activityTypesTable.id }).from(activityTypesTable)
    .where(and(eq(activityTypesTable.id, activityTypeId), eq(activityTypesTable.propertyId, propertyId), eq(activityTypesTable.active, true))).limit(1);
  if (!type) return void res.status(400).json({ error: "Unknown activity type" });

  const uniqueLocations = [...new Set(namedLocationIds)];
  if (uniqueLocations.length > 0) {
    const found = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(and(inArray(namedLocationsTable.id, uniqueLocations), eq(namedLocationsTable.propertyId, propertyId),
        eq(namedLocationsTable.active, true)));
    if (found.length !== uniqueLocations.length) return void res.status(400).json({ error: "Unknown location" });
  }

  const uniqueParticipants = [...new Set(participantUserIds)];
  if (uniqueParticipants.length > 0) {
    const found = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(inArray(usersTable.id, uniqueParticipants), eq(usersTable.propertyId, propertyId), eq(usersTable.active, true)));
    if (found.length !== uniqueParticipants.length) return void res.status(400).json({ error: "Unknown participant" });
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(activityLogsTable).values({
      // Legacy single-location column keeps the first pick for backwards compatibility.
      propertyId, activityTypeId, namedLocationId: uniqueLocations[0] ?? null,
      activityDate, durationMinutes, notes: notes ?? null,
      recordedByUserId: req.authUser!.id,
    }).returning();
    if (uniqueLocations.length > 0) {
      await tx.insert(activityLogLocationsTable)
        .values(uniqueLocations.map((namedLocationId) => ({ activityLogId: row.id, namedLocationId })));
    }
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
