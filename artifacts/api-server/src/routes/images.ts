import { Router } from "express";
import { db, observationImagesTable, actionImagesTable, auditEventsTable, observationsTable, actionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

// ─── Observation Images ──────────────────────────────────────────────────────

// GET /observations/:id/images
router.get("/observations/:id/images", requireAuth, async (req, res) => {
  const observationId = Number(req.params.id);
  const images = await db
    .select()
    .from(observationImagesTable)
    .where(eq(observationImagesTable.observationId, observationId))
    .orderBy(observationImagesTable.createdAt);
  res.json(images);
});

// POST /observations/:id/images
router.post("/observations/:id/images", requireAuth, async (req, res) => {
  const observationId = Number(req.params.id);
  const { storageKey, originalFilename, mimeType, fileSize, caption, imageType } = req.body;

  if (!storageKey || !originalFilename || !mimeType || !fileSize) {
    res.status(400).json({ error: "storageKey, originalFilename, mimeType and fileSize are required" });
    return;
  }

  const [obs] = await db.select({ propertyId: observationsTable.propertyId })
    .from(observationsTable).where(eq(observationsTable.id, observationId)).limit(1);
  if (!obs) { res.status(404).json({ error: "Observation not found" }); return; }

  const [image] = await db.insert(observationImagesTable).values({
    observationId,
    storageKey,
    originalFilename,
    mimeType,
    fileSize: Number(fileSize),
    caption: caption || null,
    imageType: imageType || "observation",
    uploadedByUserId: req.session.userId!,
  }).returning();

  await db.insert(auditEventsTable).values({
    propertyId: obs.propertyId,
    observationId,
    userId: req.session.userId!,
    eventType: "photo_added",
    newValue: originalFilename,
  });

  res.status(201).json(image);
});

// DELETE /observations/:id/images/:imageId
router.delete("/observations/:id/images/:imageId", requireAuth, async (req, res) => {
  const observationId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  const [image] = await db.select().from(observationImagesTable)
    .where(and(eq(observationImagesTable.id, imageId), eq(observationImagesTable.observationId, observationId)))
    .limit(1);
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }

  await db.delete(observationImagesTable).where(eq(observationImagesTable.id, imageId));
  res.status(204).send();
});

// ─── Action Images ───────────────────────────────────────────────────────────

// GET /actions/:id/images
router.get("/actions/:id/images", requireAuth, async (req, res) => {
  const actionId = Number(req.params.id);
  const images = await db
    .select()
    .from(actionImagesTable)
    .where(eq(actionImagesTable.actionId, actionId))
    .orderBy(actionImagesTable.createdAt);
  res.json(images);
});

// POST /actions/:id/images
router.post("/actions/:id/images", requireAuth, async (req, res) => {
  const actionId = Number(req.params.id);
  const { storageKey, originalFilename, mimeType, fileSize, caption } = req.body;

  if (!storageKey || !originalFilename || !mimeType || !fileSize) {
    res.status(400).json({ error: "storageKey, originalFilename, mimeType and fileSize are required" });
    return;
  }

  const [action] = await db.select({ propertyId: actionsTable.propertyId, observationId: actionsTable.observationId })
    .from(actionsTable).where(eq(actionsTable.id, actionId)).limit(1);
  if (!action) { res.status(404).json({ error: "Action not found" }); return; }

  const [image] = await db.insert(actionImagesTable).values({
    actionId,
    storageKey,
    originalFilename,
    mimeType,
    fileSize: Number(fileSize),
    caption: caption || null,
    uploadedByUserId: req.session.userId!,
  }).returning();

  await db.insert(auditEventsTable).values({
    propertyId: action.propertyId,
    actionId,
    observationId: action.observationId,
    userId: req.session.userId!,
    eventType: "photo_added",
    newValue: originalFilename,
  });

  res.status(201).json(image);
});

// DELETE /actions/:id/images/:imageId
router.delete("/actions/:id/images/:imageId", requireAuth, async (req, res) => {
  const actionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  const [image] = await db.select().from(actionImagesTable)
    .where(and(eq(actionImagesTable.id, imageId), eq(actionImagesTable.actionId, actionId)))
    .limit(1);
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }

  await db.delete(actionImagesTable).where(eq(actionImagesTable.id, imageId));
  res.status(204).send();
});

export default router;
