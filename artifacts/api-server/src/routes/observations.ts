import { Router } from "express";
import { db, observationsTable, categoriesTable, namedLocationsTable, usersTable, actionsTable, notesTable, auditEventsTable } from "@workspace/db";
import { eq, and, desc, asc, count, sql, ilike, or, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateObservationRef } from "../lib/references";

const router = Router();

// GET /observations
router.get("/", requireAuth, async (req, res) => {
  const { status, priority, categoryId, namedLocationId, safetyIssue, publicAccessAffected, search, dateFrom, dateTo, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status) conditions.push(eq(observationsTable.status, status as any));
  if (priority) conditions.push(eq(observationsTable.priority, priority as any));
  if (categoryId) conditions.push(eq(observationsTable.categoryId, Number(categoryId)));
  if (namedLocationId) conditions.push(eq(observationsTable.namedLocationId, Number(namedLocationId)));
  if (safetyIssue === "true") conditions.push(eq(observationsTable.safetyIssue, true));
  if (publicAccessAffected === "true") conditions.push(eq(observationsTable.publicAccessAffected, true));
  if (dateFrom) conditions.push(sql`${observationsTable.observedAt} >= ${dateFrom}::timestamptz`);
  if (dateTo) conditions.push(sql`${observationsTable.observedAt} <= ${dateTo}::timestamptz`);
  if (search) {
    conditions.push(
      or(
        ilike(observationsTable.title, `%${search}%`),
        ilike(observationsTable.description, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: observationsTable.id,
        referenceNumber: observationsTable.referenceNumber,
        title: observationsTable.title,
        description: observationsTable.description,
        categoryId: observationsTable.categoryId,
        categoryName: categoriesTable.name,
        categoryColour: categoriesTable.displayColour,
        priority: observationsTable.priority,
        status: observationsTable.status,
        observedAt: observationsTable.observedAt,
        reportedByUserId: observationsTable.reportedByUserId,
        reportedByName: usersTable.name,
        latitude: observationsTable.latitude,
        longitude: observationsTable.longitude,
        gpsAccuracyMetres: observationsTable.gpsAccuracyMetres,
        namedLocationId: observationsTable.namedLocationId,
        namedLocationName: namedLocationsTable.name,
        safetyIssue: observationsTable.safetyIssue,
        publicAccessAffected: observationsTable.publicAccessAffected,
        machineryRequired: observationsTable.machineryRequired,
        followUpRequired: observationsTable.followUpRequired,
        propertyId: observationsTable.propertyId,
        createdAt: observationsTable.createdAt,
        updatedAt: observationsTable.updatedAt,
      })
      .from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
      .where(where)
      .orderBy(desc(observationsTable.createdAt))
      .limit(limitNum)
      .offset(offset),
    db.select({ total: count() }).from(observationsTable).where(where),
  ]);

  // Get action counts
  const ids = rows.map((r) => r.id);
  let actionCounts: Record<number, number> = {};
  if (ids.length > 0) {
    const counts = await db
      .select({ observationId: actionsTable.observationId, cnt: count() })
      .from(actionsTable)
      .where(inArray(actionsTable.observationId, ids))
      .groupBy(actionsTable.observationId);
    for (const c of counts) {
      if (c.observationId) actionCounts[c.observationId] = Number(c.cnt);
    }
  }

  res.json({
    observations: rows.map((r) => ({ ...r, actionCount: actionCounts[r.id] ?? 0 })),
    total: Number(total),
    page: pageNum,
    limit: limitNum,
  });
});

// POST /observations
router.post("/", requireAuth, async (req, res) => {
  const { title, categoryId, priority, observedAt, description, status, latitude, longitude, gpsAccuracyMetres, namedLocationId, safetyIssue, publicAccessAffected, machineryRequired, followUpRequired, createdOffline, offlineId } = req.body;

  if (!title || !categoryId || !priority || !observedAt) {
    res.status(400).json({ error: "title, categoryId, priority, and observedAt are required" });
    return;
  }

  const propertyId = req.session.propertyId ?? 1;
  const referenceNumber = await generateObservationRef(propertyId);

  const [obs] = await db.insert(observationsTable).values({
    propertyId,
    referenceNumber,
    title,
    description,
    categoryId: Number(categoryId),
    priority,
    status: status ?? "submitted",
    observedAt: new Date(observedAt),
    reportedByUserId: req.session.userId!,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    gpsAccuracyMetres: gpsAccuracyMetres ?? null,
    namedLocationId: namedLocationId ? Number(namedLocationId) : null,
    safetyIssue: safetyIssue ?? false,
    publicAccessAffected: publicAccessAffected ?? false,
    machineryRequired: machineryRequired ?? false,
    followUpRequired: followUpRequired ?? false,
    createdOffline: createdOffline ?? false,
    offlineId: offlineId ?? null,
  }).returning();

  // Audit
  await db.insert(auditEventsTable).values({
    propertyId,
    observationId: obs.id,
    userId: req.session.userId!,
    eventType: "observation_created",
    newValue: title,
  });

  res.status(201).json({ ...obs, actionCount: 0 });
});

// GET /observations/map
router.get("/map", requireAuth, async (req, res) => {
  const { status, priority, categoryId, namedLocationId, safetyIssue } = req.query as Record<string, string>;
  const conditions = [sql`${observationsTable.latitude} IS NOT NULL`];
  if (status) conditions.push(eq(observationsTable.status, status as any));
  if (priority) conditions.push(eq(observationsTable.priority, priority as any));
  if (categoryId) conditions.push(eq(observationsTable.categoryId, Number(categoryId)));
  if (namedLocationId) conditions.push(eq(observationsTable.namedLocationId, Number(namedLocationId)));
  if (safetyIssue === "true") conditions.push(eq(observationsTable.safetyIssue, true));

  const rows = await db
    .select({
      id: observationsTable.id,
      title: observationsTable.title,
      referenceNumber: observationsTable.referenceNumber,
      priority: observationsTable.priority,
      status: observationsTable.status,
      latitude: observationsTable.latitude,
      longitude: observationsTable.longitude,
      categoryName: categoriesTable.name,
      categoryColour: categoriesTable.displayColour,
      namedLocationName: namedLocationsTable.name,
      safetyIssue: observationsTable.safetyIssue,
    })
    .from(observationsTable)
    .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
    .where(and(...conditions))
    .orderBy(desc(observationsTable.createdAt))
    .limit(500);

  res.json(rows);
});

// GET /observations/:id
router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const [obs] = await db
    .select({
      id: observationsTable.id,
      referenceNumber: observationsTable.referenceNumber,
      title: observationsTable.title,
      description: observationsTable.description,
      categoryId: observationsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColour: categoriesTable.displayColour,
      priority: observationsTable.priority,
      status: observationsTable.status,
      observedAt: observationsTable.observedAt,
      reportedByUserId: observationsTable.reportedByUserId,
      reportedByName: usersTable.name,
      latitude: observationsTable.latitude,
      longitude: observationsTable.longitude,
      gpsAccuracyMetres: observationsTable.gpsAccuracyMetres,
      namedLocationId: observationsTable.namedLocationId,
      namedLocationName: namedLocationsTable.name,
      safetyIssue: observationsTable.safetyIssue,
      publicAccessAffected: observationsTable.publicAccessAffected,
      machineryRequired: observationsTable.machineryRequired,
      followUpRequired: observationsTable.followUpRequired,
      propertyId: observationsTable.propertyId,
      createdAt: observationsTable.createdAt,
      updatedAt: observationsTable.updatedAt,
    })
    .from(observationsTable)
    .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
    .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
    .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
    .where(eq(observationsTable.id, id))
    .limit(1);

  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }

  const [actions, notes, auditEvents] = await Promise.all([
    db.select({
      id: actionsTable.id,
      referenceNumber: actionsTable.referenceNumber,
      title: actionsTable.title,
      description: actionsTable.description,
      observationId: actionsTable.observationId,
      assignedToUserId: actionsTable.assignedToUserId,
      assignedToName: usersTable.name,
      createdByUserId: actionsTable.createdByUserId,
      priority: actionsTable.priority,
      status: actionsTable.status,
      dueDate: actionsTable.dueDate,
      completedAt: actionsTable.completedAt,
      completionNote: actionsTable.completionNote,
      equipmentRequired: actionsTable.equipmentRequired,
      contractorRequired: actionsTable.contractorRequired,
      propertyId: actionsTable.propertyId,
      createdAt: actionsTable.createdAt,
      updatedAt: actionsTable.updatedAt,
    })
      .from(actionsTable)
      .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
      .where(eq(actionsTable.observationId, id))
      .orderBy(asc(actionsTable.createdAt)),
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
      .where(eq(notesTable.observationId, id))
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
      .where(eq(auditEventsTable.observationId, id))
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(50),
  ]);

  res.json({ ...obs, actions, notes, auditEvents });
});

// PATCH /observations/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, categoryId, priority, status, observedAt, latitude, longitude, namedLocationId, safetyIssue, publicAccessAffected, machineryRequired, followUpRequired } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (categoryId !== undefined) updates.categoryId = Number(categoryId);
  if (priority !== undefined) updates.priority = priority;
  if (status !== undefined) updates.status = status;
  if (observedAt !== undefined) updates.observedAt = new Date(observedAt);
  if (latitude !== undefined) updates.latitude = latitude;
  if (longitude !== undefined) updates.longitude = longitude;
  if (namedLocationId !== undefined) updates.namedLocationId = namedLocationId;
  if (safetyIssue !== undefined) updates.safetyIssue = safetyIssue;
  if (publicAccessAffected !== undefined) updates.publicAccessAffected = publicAccessAffected;
  if (machineryRequired !== undefined) updates.machineryRequired = machineryRequired;
  if (followUpRequired !== undefined) updates.followUpRequired = followUpRequired;

  const [obs] = await db.update(observationsTable).set(updates).where(eq(observationsTable.id, id)).returning();
  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }

  await db.insert(auditEventsTable).values({
    propertyId: obs.propertyId,
    observationId: id,
    userId: req.session.userId!,
    eventType: "observation_edited",
  });

  res.json(obs);
});

// DELETE /observations/:id
router.delete("/:id", requireAuth, async (req, res) => {
  if (req.session.userRole !== "administrator") {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  const id = Number(req.params.id);
  await db.delete(observationsTable).where(eq(observationsTable.id, id));
  res.status(204).send();
});

// PATCH /observations/:id/status
router.patch("/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status, reason } = req.body;
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "resolved") updates.resolvedAt = new Date();
  if (status === "closed") updates.closedAt = new Date();

  const [obs] = await db.update(observationsTable).set(updates).where(eq(observationsTable.id, id)).returning();
  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }

  await db.insert(auditEventsTable).values({
    propertyId: obs.propertyId,
    observationId: id,
    userId: req.session.userId!,
    eventType: "status_changed",
    fieldName: "status",
    newValue: status,
    previousValue: undefined,
    metadata: reason ? { reason } : undefined,
  });

  res.json(obs);
});

export default router;
