import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  actionImagesTable, actionsTable, auditEventsTable, db, observationImagesTable, observationsTable,
} from "@workspace/db";
import { canUpdateAction, isManager, requireAuth } from "../lib/auth";
import { idSchema, validationError } from "../lib/validation";
import { consumeUploadGrant, storage } from "./storage";

const router = Router();
const imageInput = z.object({
  storageKey: z.string().regex(/^\/objects\/uploads\/[0-9a-f-]{36}$/i),
  originalFilename: z.string().trim().min(1).max(180),
  mimeType: z.string().max(80),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  caption: z.string().trim().max(1000).optional().nullable(),
  imageType: z.enum(["observation", "progress", "completion"]).optional(),
  photoUuid: z.string().uuid().optional(),
}).strict();

router.get("/observations/:id/images", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const propertyId = req.authUser!.propertyId!;
  const [observation] = await db.select({ id: observationsTable.id }).from(observationsTable)
    .where(and(eq(observationsTable.id, id.data), eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt))).limit(1);
  if (!observation) return void res.status(404).json({ error: "Observation not found" });
  const rows = await db.select().from(observationImagesTable)
    .where(and(eq(observationImagesTable.observationId, id.data), isNull(observationImagesTable.deletedAt)))
    .orderBy(observationImagesTable.createdAt);
  res.json(rows);
});

router.post("/observations/:id/images", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = imageInput.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [observation] = await db.select({ id: observationsTable.id, propertyId: observationsTable.propertyId }).from(observationsTable)
    .where(and(eq(observationsTable.id, id.data), eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt))).limit(1);
  if (!observation) return void res.status(404).json({ error: "Observation not found" });
  // Idempotent replay: a retried queued upload must never attach twice.
  if (parsed.data.photoUuid) {
    const [existing] = await db.select().from(observationImagesTable)
      .where(eq(observationImagesTable.photoUuid, parsed.data.photoUuid)).limit(1);
    if (existing) return void res.status(200).json(existing);
  }
  let normalised;
  try {
    normalised = await consumeUploadGrant(parsed.data.storageKey, user.id, user.propertyId!);
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_GRANT_INVALID") {
      return void res.status(400).json({ error: "Upload is missing, expired, already used, or belongs to another user" });
    }
    throw error;
  }
  const image = await db.transaction(async (tx) => {
    const [created] = await tx.insert(observationImagesTable).values({
      observationId: id.data,
      storageKey: parsed.data.storageKey,
      originalFilename: normalised.originalFilename,
      mimeType: normalised.mimeType,
      fileSize: normalised.fileSize,
      caption: parsed.data.caption ?? null,
      imageType: parsed.data.imageType ?? "observation",
      photoUuid: parsed.data.photoUuid ?? null,
      uploadedByUserId: user.id,
    }).returning();
    await tx.insert(auditEventsTable).values({
      propertyId: user.propertyId!, observationId: id.data, userId: user.id,
      eventType: "photo_added", newValue: normalised.originalFilename,
    });
    return created;
  });
  res.status(201).json(image);
});

router.delete("/observations/:id/images/:imageId", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const imageId = idSchema.safeParse(req.params.imageId);
  if (!id.success || !imageId.success) return validationError(res, !id.success ? id.error : imageId.error);
  const user = req.authUser!;
  const [row] = await db.select({ image: observationImagesTable, propertyId: observationsTable.propertyId })
    .from(observationImagesTable).innerJoin(observationsTable, eq(observationImagesTable.observationId, observationsTable.id))
    .where(and(eq(observationImagesTable.id, imageId.data), eq(observationImagesTable.observationId, id.data),
      eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt))).limit(1);
  if (!row) return void res.status(404).json({ error: "Image not found" });
  if (!isManager(user) && row.image.uploadedByUserId !== user.id) return void res.status(403).json({ error: "Insufficient permissions" });
  if (row.image.deletedAt) return void res.status(404).json({ error: "Image not found" });
  // Recoverable delete: mark the row deleted and keep the object bytes so an
  // operator can restore. No purge happens in this flow.
  await db.transaction(async (tx) => {
    await tx.update(observationImagesTable).set({ deletedAt: new Date(), deletedByUserId: user.id })
      .where(eq(observationImagesTable.id, imageId.data));
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, observationId: id.data, userId: user.id,
      eventType: "photo_removed", previousValue: row.image.originalFilename });
  });
  res.status(204).send();
});

router.get("/actions/:id/images", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const [action] = await db.select({ id: actionsTable.id }).from(actionsTable)
    .where(and(eq(actionsTable.id, id.data), eq(actionsTable.propertyId, req.authUser!.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!action) return void res.status(404).json({ error: "Action not found" });
  res.json(await db.select().from(actionImagesTable)
    .where(and(eq(actionImagesTable.actionId, id.data), isNull(actionImagesTable.deletedAt)))
    .orderBy(actionImagesTable.createdAt));
});

router.post("/actions/:id/images", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = imageInput.omit({ imageType: true }).safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const user = req.authUser!;
  const [action] = await db.select().from(actionsTable).where(and(eq(actionsTable.id, id.data),
    eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!action) return void res.status(404).json({ error: "Action not found" });
  if (!canUpdateAction(user, action.assignedToUserId)) return void res.status(403).json({ error: "Only the assignee or a manager may add action photos" });
  // Idempotent replay: a retried queued upload must never attach twice.
  if (parsed.data.photoUuid) {
    const [existing] = await db.select().from(actionImagesTable)
      .where(eq(actionImagesTable.photoUuid, parsed.data.photoUuid)).limit(1);
    if (existing) return void res.status(200).json(existing);
  }
  let normalised;
  try {
    normalised = await consumeUploadGrant(parsed.data.storageKey, user.id, user.propertyId!);
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_GRANT_INVALID") {
      return void res.status(400).json({ error: "Upload is missing, expired, already used, or belongs to another user" });
    }
    throw error;
  }
  const image = await db.transaction(async (tx) => {
    const [created] = await tx.insert(actionImagesTable).values({ actionId: id.data, storageKey: parsed.data.storageKey,
      originalFilename: normalised.originalFilename, mimeType: normalised.mimeType, fileSize: normalised.fileSize,
      caption: parsed.data.caption ?? null, photoUuid: parsed.data.photoUuid ?? null, uploadedByUserId: user.id }).returning();
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, actionId: id.data,
      observationId: action.observationId, userId: user.id, eventType: "photo_added", newValue: normalised.originalFilename });
    return created;
  });
  res.status(201).json(image);
});

router.delete("/actions/:id/images/:imageId", requireAuth, async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const imageId = idSchema.safeParse(req.params.imageId);
  if (!id.success || !imageId.success) return validationError(res, !id.success ? id.error : imageId.error);
  const user = req.authUser!;
  const [row] = await db.select({ image: actionImagesTable, action: actionsTable }).from(actionImagesTable)
    .innerJoin(actionsTable, eq(actionImagesTable.actionId, actionsTable.id))
    .where(and(eq(actionImagesTable.id, imageId.data), eq(actionImagesTable.actionId, id.data),
      eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt))).limit(1);
  if (!row) return void res.status(404).json({ error: "Image not found" });
  if (!canUpdateAction(user, row.action.assignedToUserId) || (!isManager(user) && row.image.uploadedByUserId !== user.id)) {
    return void res.status(403).json({ error: "Insufficient permissions" });
  }
  if (row.image.deletedAt) return void res.status(404).json({ error: "Image not found" });
  // Recoverable delete: mark the row deleted and keep the object bytes.
  await db.transaction(async (tx) => {
    await tx.update(actionImagesTable).set({ deletedAt: new Date(), deletedByUserId: user.id })
      .where(eq(actionImagesTable.id, imageId.data));
    await tx.insert(auditEventsTable).values({ propertyId: user.propertyId!, actionId: id.data,
      observationId: row.action.observationId, userId: user.id, eventType: "photo_removed", previousValue: row.image.originalFilename });
  });
  res.status(204).send();
});

export default router;
