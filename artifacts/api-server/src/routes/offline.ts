import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  actionsTable, activityLogLocationsTable, activityLogParticipantsTable, activityLogsTable,
  activityTypesTable, categoriesTable, db, namedLocationsTable, notesTable,
  observationImagesTable, observationsTable, usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

/**
 * Whole-active-dataset snapshot for the deliberate offline preload.
 * Everything is scoped to the caller's property. Deleted/archived records are
 * excluded; the client relies on the snapshot being complete, so a fresh
 * preload naturally removes anything archived since the last one.
 */
router.get("/snapshot", requireAuth, async (req, res) => {
  const propertyId = req.authUser!.propertyId!;
  const [categories, locations, activityTypes, users, observations, actions, notes, activities, participants, activityLocations, observationImages] = await Promise.all([
    db.select().from(categoriesTable).where(eq(categoriesTable.propertyId, propertyId)),
    db.select().from(namedLocationsTable).where(eq(namedLocationsTable.propertyId, propertyId)),
    db.select().from(activityTypesTable).where(eq(activityTypesTable.propertyId, propertyId)),
    db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role, active: usersTable.active })
      .from(usersTable).where(eq(usersTable.propertyId, propertyId)),
    db.select().from(observationsTable).where(and(eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt))),
    db.select().from(actionsTable).where(and(eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt))),
    db.select().from(notesTable),
    db.select().from(activityLogsTable).where(eq(activityLogsTable.propertyId, propertyId)),
    db.select().from(activityLogParticipantsTable),
    db.select().from(activityLogLocationsTable),
    db.select({ id: observationImagesTable.id, observationId: observationImagesTable.observationId,
      originalFilename: observationImagesTable.originalFilename, mimeType: observationImagesTable.mimeType,
      imageType: observationImagesTable.imageType, caption: observationImagesTable.caption,
      createdAt: observationImagesTable.createdAt })
      .from(observationImagesTable),
  ]);
  // Keep only child rows that belong to this property's parents.
  const obsIds = new Set(observations.map((o) => o.id));
  const actionIds = new Set(actions.map((a) => a.id));
  const activityIds = new Set(activities.map((a) => a.id));
  res.json({
    serverTime: new Date().toISOString(),
    propertyId,
    categories, locations, activityTypes, users,
    observations, actions,
    notes: notes.filter((n) => (n.observationId != null && obsIds.has(n.observationId)) || (n.actionId != null && actionIds.has(n.actionId))),
    activities,
    activityParticipants: participants.filter((p) => activityIds.has(p.activityLogId)),
    activityLocations: activityLocations.filter((l) => activityIds.has(l.activityLogId)),
    observationImages: observationImages.filter((i) => obsIds.has(i.observationId)),
  });
});

export default router;
