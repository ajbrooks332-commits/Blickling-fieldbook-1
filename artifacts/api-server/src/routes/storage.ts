import { Readable } from "stream";
import { Router } from "express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
  actionImagesTable, actionsTable, db, observationImagesTable, observationsTable, uploadGrantsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { validationError } from "../lib/validation";

const router = Router();
const storage = new ObjectStorageService();
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const uploadSchema = z.object({
  name: z.string().trim().min(1).max(180),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  contentType: z.enum(ALLOWED_TYPES),
}).strict();

router.post("/storage/uploads/request-url", requireAuth, async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  await db.insert(uploadGrantsTable).values({
    objectPath,
    userId: req.authUser!.id,
    propertyId: req.authUser!.propertyId!,
    originalFilename: parsed.data.name,
    expectedMimeType: parsed.data.contentType,
    expectedSize: parsed.data.size,
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
  });
  res.json({ uploadURL, objectPath, metadata: parsed.data });
});

router.get("/storage/objects/*path", requireAuth, async (req, res) => {
  const raw = req.params.path;
  const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
  const propertyId = req.authUser!.propertyId!;

  const [observationImage] = await db.select({ id: observationImagesTable.id }).from(observationImagesTable)
    .innerJoin(observationsTable, eq(observationImagesTable.observationId, observationsTable.id))
    .where(and(eq(observationImagesTable.storageKey, objectPath), eq(observationsTable.propertyId, propertyId), isNull(observationsTable.deletedAt))).limit(1);
  const [actionImage] = observationImage ? [] : await db.select({ id: actionImagesTable.id }).from(actionImagesTable)
    .innerJoin(actionsTable, eq(actionImagesTable.actionId, actionsTable.id))
    .where(and(eq(actionImagesTable.storageKey, objectPath), eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt))).limit(1);
  if (!observationImage && !actionImage) return void res.status(404).json({ error: "Object not found" });

  try {
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file, 0);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!response.body) return void res.end();
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return void res.status(404).json({ error: "Object not found" });
    throw error;
  }
});

export async function consumeUploadGrant(objectPath: string, userId: number, propertyId: number) {
  const [grant] = await db.update(uploadGrantsTable).set({ consumedAt: new Date() }).where(and(
    eq(uploadGrantsTable.objectPath, objectPath), eq(uploadGrantsTable.userId, userId),
    eq(uploadGrantsTable.propertyId, propertyId), isNull(uploadGrantsTable.consumedAt),
    gt(uploadGrantsTable.expiresAt, new Date()),
  )).returning();
  if (!grant) throw new Error("UPLOAD_GRANT_INVALID");
  try {
    const normalised = await storage.validateAndNormaliseImage(objectPath);
    if (normalised.originalFileSize !== grant.expectedSize || normalised.originalMimeType !== grant.expectedMimeType) {
      await storage.deleteObjectEntity(objectPath).catch(() => undefined);
      throw new Error("UPLOAD_GRANT_INVALID");
    }
    return { mimeType: normalised.mimeType, fileSize: normalised.fileSize, originalFilename: grant.originalFilename };
  } catch (error) {
    await storage.deleteObjectEntity(objectPath).catch(() => undefined);
    if (error instanceof Error && error.message === "UPLOAD_GRANT_INVALID") throw error;
    throw new Error("UPLOAD_GRANT_INVALID");
  }
}

export { storage };
export default router;
