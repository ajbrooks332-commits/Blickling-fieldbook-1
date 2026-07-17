import { Router } from "express";
import { db, actionsTable, observationsTable, usersTable, notesTable, auditEventsTable, namedLocationsTable } from "@workspace/db";
import { eq, and, desc, asc, count, sql, ilike, or, lte, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateActionRef } from "../lib/references";

const router = Router();

function formatAction(a: any) {
  return {
    id: a.id,
    referenceNumber: a.referenceNumber,
    title: a.title,
    description: a.description,
    observationId: a.observationId,
    observationTitle: a.observationTitle ?? null,
    observationRef: a.observationRef ?? null,
    assignedToUserId: a.assignedToUserId,
    assignedToName: a.assignedToName ?? null,
    createdByUserId: a.createdByUserId,
    priority: a.priority,
    status: a.status,
    dueDate: a.dueDate,
    completedAt: a.completedAt,
    completionNote: a.completionNote,
    namedLocationName: a.namedLocationName ?? null,
    estimatedMinutes: a.estimatedMinutes,
    equipmentRequired: a.equipmentRequired,
    contractorRequired: a.contractorRequired,
    waitingReason: a.waitingReason ?? null,
    cancellationReason: a.cancellationReason ?? null,
    propertyId: a.propertyId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const actionSelectFields = {
  id: actionsTable.id,
  referenceNumber: actionsTable.referenceNumber,
  title: actionsTable.title,
  description: actionsTable.description,
  observationId: actionsTable.observationId,
  observationTitle: observationsTable.title,
  observationRef: observationsTable.referenceNumber,
  assignedToUserId: actionsTable.assignedToUserId,
  assignedToName: usersTable.name,
  createdByUserId: actionsTable.createdByUserId,
  priority: actionsTable.priority,
  status: actionsTable.status,
  dueDate: actionsTable.dueDate,
  completedAt: actionsTable.completedAt,
  completionNote: actionsTable.completionNote,
  namedLocationName: namedLocationsTable.name,
  estimatedMinutes: actionsTable.estimatedMinutes,
  equipmentRequired: actionsTable.equipmentRequired,
  contractorRequired: actionsTable.contractorRequired,
  waitingReason: actionsTable.waitingReason,
  cancellationReason: actionsTable.cancellationReason,
  propertyId: actionsTable.propertyId,
  createdAt: actionsTable.createdAt,
  updatedAt: actionsTable.updatedAt,
};

// GET /actions/my
router.get("/actions/my", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const baseQuery = db
    .select(actionSelectFields)
    .from(actionsTable)
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id));

  const [overdue, dueToday, dueThisWeek, later, recentlyCompleted] = await Promise.all([
    // Overdue: past due date, not completed/cancelled
    baseQuery
      .where(and(
        eq(actionsTable.assignedToUserId, userId),
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`${actionsTable.dueDate} < ${startOfToday.toISOString()}::timestamptz`
      ))
      .orderBy(asc(actionsTable.dueDate)),
    // Due today
    baseQuery
      .where(and(
        eq(actionsTable.assignedToUserId, userId),
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        gte(actionsTable.dueDate, startOfToday),
        lte(actionsTable.dueDate, endOfToday)
      ))
      .orderBy(asc(actionsTable.dueDate)),
    // Due this week (after today)
    baseQuery
      .where(and(
        eq(actionsTable.assignedToUserId, userId),
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`${actionsTable.dueDate} > ${endOfToday.toISOString()}::timestamptz`,
        lte(actionsTable.dueDate, endOfWeek)
      ))
      .orderBy(asc(actionsTable.dueDate)),
    // Later
    baseQuery
      .where(and(
        eq(actionsTable.assignedToUserId, userId),
        sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`,
        sql`(${actionsTable.dueDate} IS NULL OR ${actionsTable.dueDate} > ${endOfWeek.toISOString()}::timestamptz)`
      ))
      .orderBy(asc(actionsTable.dueDate)),
    // Recently completed
    baseQuery
      .where(and(
        eq(actionsTable.assignedToUserId, userId),
        eq(actionsTable.status, "completed"),
        gte(actionsTable.completedAt, thirtyDaysAgo)
      ))
      .orderBy(desc(actionsTable.completedAt))
      .limit(10),
  ]);

  res.json({
    overdue: overdue.map(formatAction),
    dueToday: dueToday.map(formatAction),
    dueThisWeek: dueThisWeek.map(formatAction),
    later: later.map(formatAction),
    recentlyCompleted: recentlyCompleted.map(formatAction),
  });
});

// GET /actions
router.get("/actions", requireAuth, async (req, res) => {
  const { status, priority, assignedUserId, observationId, overdue, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(actionsTable.status, status as any));
  if (priority) conditions.push(eq(actionsTable.priority, priority as any));
  if (assignedUserId) conditions.push(eq(actionsTable.assignedToUserId, Number(assignedUserId)));
  if (observationId) conditions.push(eq(actionsTable.observationId, Number(observationId)));
  if (overdue === "true") {
    conditions.push(sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`);
    conditions.push(sql`${actionsTable.dueDate} < NOW()`);
  }
  if (search) {
    conditions.push(or(ilike(actionsTable.title, `%${search}%`), ilike(actionsTable.description, `%${search}%`))!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(actionSelectFields)
      .from(actionsTable)
      .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
      .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .where(where)
      .orderBy(desc(actionsTable.createdAt))
      .limit(limitNum)
      .offset(offset),
    db.select({ total: count() }).from(actionsTable).where(where),
  ]);

  res.json({
    actions: rows.map(formatAction),
    total: Number(total),
    page: pageNum,
    limit: limitNum,
  });
});

// POST /actions
router.post("/actions", requireAuth, async (req, res) => {
  const { title, description, observationId, assignedToUserId, priority, status, dueDate, estimatedMinutes, equipmentRequired, contractorRequired, notes } = req.body;

  if (!title || !priority || !status) {
    res.status(400).json({ error: "title, priority, and status are required" });
    return;
  }

  const propertyId = req.session.propertyId ?? 1;
  const referenceNumber = await generateActionRef(propertyId);

  const [action] = await db.insert(actionsTable).values({
    propertyId,
    referenceNumber,
    title,
    description,
    observationId: observationId ? Number(observationId) : null,
    assignedToUserId: assignedToUserId ? Number(assignedToUserId) : null,
    createdByUserId: req.session.userId!,
    priority,
    status: status ?? "not_started",
    dueDate: dueDate ? new Date(dueDate) : null,
    estimatedMinutes: estimatedMinutes ?? null,
    equipmentRequired: equipmentRequired ?? false,
    contractorRequired: contractorRequired ?? false,
  }).returning();

  // If action is linked to an observation, update obs status to action_required
  if (observationId) {
    await db.update(observationsTable)
      .set({ status: "action_required", updatedAt: new Date() })
      .where(and(eq(observationsTable.id, Number(observationId)), sql`${observationsTable.status} NOT IN ('resolved', 'closed', 'cancelled')`));
  }

  await db.insert(auditEventsTable).values({
    propertyId,
    observationId: observationId ? Number(observationId) : null,
    actionId: action.id,
    userId: req.session.userId!,
    eventType: "action_created",
    newValue: title,
  });

  // Add initial note if provided
  if (notes) {
    await db.insert(notesTable).values({
      actionId: action.id,
      body: notes,
      createdByUserId: req.session.userId!,
    });
  }

  res.status(201).json(formatAction({ ...action, observationTitle: null, observationRef: null, assignedToName: null, namedLocationName: null }));
});

// GET /actions/:id
router.get("/actions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const [action] = await db
    .select(actionSelectFields)
    .from(actionsTable)
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id))
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
    .where(eq(actionsTable.id, id))
    .limit(1);

  if (!action) {
    res.status(404).json({ error: "Action not found" });
    return;
  }

  const [notes, auditEvents] = await Promise.all([
    db.select({
      id: notesTable.id,
      body: notesTable.body,
      observationId: notesTable.observationId,
      actionId: notesTable.actionId,
      createdByUserId: notesTable.createdByUserId,
      createdByName: usersTable.name,
      createdAt: notesTable.createdAt,
    })
      .from(notesTable)
      .leftJoin(usersTable, eq(notesTable.createdByUserId, usersTable.id))
      .where(eq(notesTable.actionId, id))
      .orderBy(asc(notesTable.createdAt)),
    db.select({
      id: auditEventsTable.id,
      eventType: auditEventsTable.eventType,
      fieldName: auditEventsTable.fieldName,
      previousValue: auditEventsTable.previousValue,
      newValue: auditEventsTable.newValue,
      userId: auditEventsTable.userId,
      userName: usersTable.name,
      createdAt: auditEventsTable.createdAt,
    })
      .from(auditEventsTable)
      .leftJoin(usersTable, eq(auditEventsTable.userId, usersTable.id))
      .where(eq(auditEventsTable.actionId, id))
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(50),
  ]);

  res.json({ ...formatAction(action), notes, auditEvents });
});

// PATCH /actions/:id
router.patch("/actions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, assignedToUserId, priority, status, dueDate, estimatedMinutes, equipmentRequired, contractorRequired, completionNote, waitingReason, cancellationReason } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (assignedToUserId !== undefined) updates.assignedToUserId = assignedToUserId;
  if (priority !== undefined) updates.priority = priority;
  if (status !== undefined) {
    updates.status = status;
    if (status === "completed") updates.completedAt = new Date();
  }
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
  if (estimatedMinutes !== undefined) updates.estimatedMinutes = estimatedMinutes;
  if (equipmentRequired !== undefined) updates.equipmentRequired = equipmentRequired;
  if (contractorRequired !== undefined) updates.contractorRequired = contractorRequired;
  if (completionNote !== undefined) updates.completionNote = completionNote;
  if (waitingReason !== undefined) updates.waitingReason = waitingReason;
  if (cancellationReason !== undefined) updates.cancellationReason = cancellationReason;

  const [action] = await db.update(actionsTable).set(updates).where(eq(actionsTable.id, id)).returning();
  if (!action) {
    res.status(404).json({ error: "Action not found" });
    return;
  }

  await db.insert(auditEventsTable).values({
    propertyId: action.propertyId,
    actionId: id,
    observationId: action.observationId,
    userId: req.session.userId!,
    eventType: "action_edited",
  });

  res.json(formatAction({ ...action, observationTitle: null, observationRef: null, assignedToName: null, namedLocationName: null }));
});

// PATCH /actions/:id/status
router.patch("/actions/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status, completionNote, waitingReason, cancellationReason } = req.body;

  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  const [existing] = await db.select().from(actionsTable).where(eq(actionsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Action not found" });
    return;
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "completed") {
    updates.completedAt = new Date();
    if (completionNote) updates.completionNote = completionNote;
  }
  if (status === "waiting" && waitingReason) updates.waitingReason = waitingReason;
  if (status === "cancelled" && cancellationReason) updates.cancellationReason = cancellationReason;

  const [action] = await db.update(actionsTable).set(updates).where(eq(actionsTable.id, id)).returning();

  await db.insert(auditEventsTable).values({
    propertyId: action.propertyId,
    actionId: id,
    observationId: action.observationId,
    userId: req.session.userId!,
    eventType: "status_changed",
    fieldName: "status",
    previousValue: existing.status,
    newValue: status,
  });

  res.json(formatAction({ ...action, observationTitle: null, observationRef: null, assignedToName: null, namedLocationName: null }));
});

export default router;
