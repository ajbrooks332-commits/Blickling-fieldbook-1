import { Router } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db, activityTypesTable, activityLogsTable, activityLogParticipantsTable,
  activityLogLocationsTable, auditEventsTable, namedLocationsTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
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

export const hoursStatuses = ["staff_participants", "elapsed_only", "contractor_unknown", "other_unknown"] as const;
export type HoursStatus = (typeof hoursStatuses)[number];

const createSchema = z.object({
  activityTypeId: z.number().int().positive(),
  namedLocationIds: z.array(z.number().int().positive()).max(20).default([]),
  activityDate: activityDateSchema,
  durationMinutes: z.number().int().min(5).max(1440),
  participantUserIds: z.array(z.number().int().positive()).max(50).default([]),
  hoursStatus: z.enum(hoursStatuses).optional(),
  volunteerCount: z.number().int().min(0).max(500).optional().nullable(),
  contractorMinutes: z.number().int().min(0).max(100000).optional().nullable(),
  contractorHoursUnknown: z.boolean().default(false),
  notes: optionalText(2000),
  offlineId: z.string().uuid().optional(),
}).strict()
  .refine((v) => !(v.contractorHoursUnknown && v.contractorMinutes != null),
    "Contractor hours cannot be both recorded and unknown")
  .refine((v) => v.participantUserIds.length === 0 || (v.hoursStatus ?? "staff_participants") === "staff_participants",
    "Selected staff participants imply staff person-hours")
  // Never silently treat missing labour as zero person-hours: with no staff
  // selected and no volunteer/contractor labour recorded, the recorder must
  // say explicitly how the hours should be read.
  .refine((v) => v.participantUserIds.length > 0 || v.volunteerCount != null || v.contractorMinutes != null
    || v.contractorHoursUnknown || (v.hoursStatus != null && v.hoursStatus !== "staff_participants"),
    "Choose how these hours should be counted (no participants were selected)");

/** Derive the stored hours_status from the validated payload. */
function deriveHoursStatus(v: z.infer<typeof createSchema>): HoursStatus {
  if (v.participantUserIds.length > 0) return "staff_participants";
  if (v.hoursStatus && v.hoursStatus !== "staff_participants") return v.hoursStatus;
  if (v.contractorHoursUnknown) return "contractor_unknown";
  return "elapsed_only";
}

/** Person-hour maths shared by list and report responses. */
function labourFields(row: { durationMinutes: number; hoursStatus: string; volunteerCount: number | null;
  contractorMinutes: number | null; contractorHoursUnknown: boolean }, participantCount: number) {
  return {
    elapsedMinutes: row.durationMinutes,
    staffPersonMinutes: row.hoursStatus === "staff_participants" ? row.durationMinutes * participantCount : 0,
    volunteerPersonMinutes: row.volunteerCount != null ? row.durationMinutes * row.volunteerCount : null,
    contractorMinutes: row.contractorHoursUnknown ? null : row.contractorMinutes,
    contractorHoursUnknown: row.contractorHoursUnknown,
    hoursStatus: row.hoursStatus,
  };
}

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

// Creation of canonical activity types is manager-led. Field convenience is
// preserved: a non-manager quick-add still succeeds but is flagged as a
// PROPOSAL for manager review. Archived types are never silently reactivated —
// reactivation is an explicit manager action on a separate endpoint.
router.post("/activity-types", requireAuth, async (req, res) => {
  const parsed = z.object({ name: shortText, category: shortText.optional() }).strict().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = req.authUser!;
  const propertyId = user.propertyId!;
  const manager = user.role === "administrator" || user.role === "manager";
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
      .values({ propertyId, name, category: parsed.data.category?.trim() || "Other", sortOrder: Number(max) + 1, proposed: !manager })
      .onConflictDoNothing().returning();
    if (inserted) {
      await db.insert(auditEventsTable).values({ propertyId, userId: user.id,
        eventType: manager ? "activity_type_created" : "activity_type_proposed", newValue: name });
      return void res.status(201).json(inserted);
    }
    existing = await findExisting();
    if (!existing) return void res.status(500).json({ error: "Could not create activity type" });
  }
  if (!existing.active) {
    // Never silently reactivate archived reference data.
    return void res.status(409).json({
      error: manager
        ? "An archived activity type with this name exists. Reactivate it explicitly instead."
        : "An archived activity type with this name exists. Ask a manager to reactivate it.",
      archivedId: existing.id,
    });
  }
  res.status(200).json(existing);
});

// Explicit manager-only reactivation of an archived activity type.
router.post("/activity-types/:id/reactivate", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const user = req.authUser!;
  const [row] = await db.update(activityTypesTable).set({ active: true, proposed: false })
    .where(and(eq(activityTypesTable.id, id.data), eq(activityTypesTable.propertyId, user.propertyId!),
      eq(activityTypesTable.active, false))).returning();
  if (!row) return void res.status(404).json({ error: "Archived activity type not found" });
  await db.insert(auditEventsTable).values({ propertyId: user.propertyId!, userId: user.id,
    eventType: "activity_type_reactivated", newValue: row.name });
  res.json(row);
});

// Manager approval of a proposed (non-manager quick-added) activity type.
router.post("/activity-types/:id/approve", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const user = req.authUser!;
  const [row] = await db.update(activityTypesTable).set({ proposed: false })
    .where(and(eq(activityTypesTable.id, id.data), eq(activityTypesTable.propertyId, user.propertyId!),
      eq(activityTypesTable.proposed, true))).returning();
  if (!row) return void res.status(404).json({ error: "Proposed activity type not found" });
  await db.insert(auditEventsTable).values({ propertyId: user.propertyId!, userId: user.id,
    eventType: "activity_type_approved", newValue: row.name });
  res.json(row);
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
      hoursStatus: activityLogsTable.hoursStatus,
      volunteerCount: activityLogsTable.volunteerCount,
      contractorMinutesRaw: activityLogsTable.contractorMinutes,
      contractorHoursUnknown: activityLogsTable.contractorHoursUnknown,
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
    activities: rows.map(({ contractorMinutesRaw, ...row }) => {
      const rowParticipants = participants.get(row.id) ?? [];
      return {
        ...row,
        ...labourFields({ ...row, contractorMinutes: contractorMinutesRaw }, rowParticipants.length),
        participants: rowParticipants,
        locations: locationMap.get(row.id) ?? [],
      };
    }),
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
  // Elapsed minutes and person-minutes are reported side by side and are
  // never conflated. Staff person-minutes multiply elapsed duration by the
  // number of SELECTED participants; unknown contractor hours stay unknown.
  const staffPersonMinutes = sql<number>`sum(CASE WHEN ${activityLogsTable.hoursStatus} = 'staff_participants'
    THEN ${activityLogsTable.durationMinutes} * (SELECT count(*) FROM activity_log_participants p WHERE p.activity_log_id = ${activityLogsTable.id})
    ELSE 0 END)`;
  const volunteerPersonMinutes = sql<number>`sum(CASE WHEN ${activityLogsTable.volunteerCount} IS NOT NULL
    THEN ${activityLogsTable.durationMinutes} * ${activityLogsTable.volunteerCount} ELSE 0 END)`;
  const contractorRecordedMinutes = sql<number>`sum(CASE WHEN ${activityLogsTable.contractorHoursUnknown}
    THEN 0 ELSE coalesce(${activityLogsTable.contractorMinutes}, 0) END)`;
  const contractorUnknownCount = sql<number>`sum(CASE WHEN ${activityLogsTable.contractorHoursUnknown} THEN 1 ELSE 0 END)`;
  const unattributedCount = sql<number>`sum(CASE WHEN ${activityLogsTable.hoursStatus} IN ('elapsed_only', 'other_unknown') THEN 1 ELSE 0 END)`;
  const byType = await db.select({
    activityTypeId: activityTypesTable.id,
    name: activityTypesTable.name,
    category: sql<string>`coalesce(${activityTypesTable.category}, 'Other')`,
    minutes: sql<number>`sum(${activityLogsTable.durationMinutes})`,
    count: sql<number>`count(*)`,
    staffPersonMinutes, volunteerPersonMinutes, contractorRecordedMinutes, contractorUnknownCount, unattributedCount,
  }).from(activityLogsTable)
    .innerJoin(activityTypesTable, eq(activityTypesTable.id, activityLogsTable.activityTypeId))
    .where(where)
    .groupBy(activityTypesTable.id, activityTypesTable.name, activityTypesTable.category)
    .orderBy(desc(sql`sum(${activityLogsTable.durationMinutes})`));
  type LabourTotals = { minutes: number; count: number; staffPersonMinutes: number; volunteerPersonMinutes: number;
    contractorRecordedMinutes: number; contractorUnknownCount: number; unattributedCount: number };
  const emptyTotals = (): LabourTotals => ({ minutes: 0, count: 0, staffPersonMinutes: 0, volunteerPersonMinutes: 0,
    contractorRecordedMinutes: 0, contractorUnknownCount: 0, unattributedCount: 0 });
  const addTo = (t: LabourTotals, r: LabourTotals) => {
    t.minutes += r.minutes; t.count += r.count; t.staffPersonMinutes += r.staffPersonMinutes;
    t.volunteerPersonMinutes += r.volunteerPersonMinutes; t.contractorRecordedMinutes += r.contractorRecordedMinutes;
    t.contractorUnknownCount += r.contractorUnknownCount; t.unattributedCount += r.unattributedCount;
  };
  const categoryTotals = new Map<string, LabourTotals>();
  const grand = emptyTotals();
  const typeRows = byType.map((r) => {
    const numeric: LabourTotals = {
      minutes: Number(r.minutes), count: Number(r.count),
      staffPersonMinutes: Number(r.staffPersonMinutes), volunteerPersonMinutes: Number(r.volunteerPersonMinutes),
      contractorRecordedMinutes: Number(r.contractorRecordedMinutes),
      contractorUnknownCount: Number(r.contractorUnknownCount), unattributedCount: Number(r.unattributedCount),
    };
    addTo(grand, numeric);
    const cat = categoryTotals.get(r.category) ?? emptyTotals();
    addTo(cat, numeric);
    categoryTotals.set(r.category, cat);
    return { activityTypeId: r.activityTypeId, name: r.name, category: r.category, ...numeric };
  });
  const byCategory = [...categoryTotals.entries()]
    .map(([category, t]) => ({ category, ...t }))
    .sort((a, b) => b.minutes - a.minutes);
  res.json({
    totalMinutes: grand.minutes, totalCount: grand.count,
    totalStaffPersonMinutes: grand.staffPersonMinutes,
    totalVolunteerPersonMinutes: grand.volunteerPersonMinutes,
    totalContractorRecordedMinutes: grand.contractorRecordedMinutes,
    contractorUnknownCount: grand.contractorUnknownCount,
    unattributedCount: grand.unattributedCount,
    byType: typeRows, byCategory,
  });
});

router.post("/activities", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const { activityTypeId, namedLocationIds, activityDate, durationMinutes, participantUserIds, notes,
    volunteerCount, contractorMinutes, contractorHoursUnknown, offlineId } = parsed.data;

  // Idempotent replay: an offline queue retry must never create a duplicate.
  if (offlineId) {
    const [existing] = await db.select({ id: activityLogsTable.id }).from(activityLogsTable)
      .where(and(eq(activityLogsTable.offlineId, offlineId), eq(activityLogsTable.propertyId, propertyId))).limit(1);
    if (existing) return void res.status(200).json({ id: existing.id });
  }

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
      hoursStatus: deriveHoursStatus(parsed.data),
      volunteerCount: volunteerCount ?? null,
      contractorMinutes: contractorHoursUnknown ? null : contractorMinutes ?? null,
      contractorHoursUnknown,
      offlineId: offlineId ?? null,
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
  await db.insert(auditEventsTable).values({ propertyId, userId: req.authUser!.id,
    eventType: "activity_created", metadata: { activityLogId: created.id } }).catch(() => undefined);
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
  await db.insert(auditEventsTable).values({ propertyId, userId: user.id,
    eventType: "activity_archived", metadata: { activityLogId: id.data } }).catch(() => undefined);
  res.status(204).end();
});

export default router;
