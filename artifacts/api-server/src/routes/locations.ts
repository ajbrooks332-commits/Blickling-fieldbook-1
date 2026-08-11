import { Router } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, namedLocationsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { coordinateSchema, idSchema, optionalText, shortText, validationError } from "../lib/validation";

const router = Router();
const locationCreate = z.object({
  name: shortText,
  description: optionalText(1000),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).strict().and(coordinateSchema);
const locationUpdate = z.object({
  name: shortText.optional(), description: optionalText(1000),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(), active: z.boolean().optional(),
}).strict().refine((value) => {
  if (value.latitude === undefined && value.longitude === undefined) return true;
  return (value.latitude == null) === (value.longitude == null);
}, { message: "Latitude and longitude must be supplied together" });

router.get("/", requireAuth, async (req, res) => {
  const rows = await db.select().from(namedLocationsTable)
    .where(eq(namedLocationsTable.propertyId, req.authUser!.propertyId!))
    .orderBy(asc(namedLocationsTable.name));
  res.json(rows);
});

router.post("/", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = locationCreate.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const [duplicate] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
    .where(and(eq(namedLocationsTable.propertyId, propertyId), eq(namedLocationsTable.name, parsed.data.name))).limit(1);
  if (duplicate) return void res.status(409).json({ error: "A location with this name already exists" });
  const [row] = await db.insert(namedLocationsTable).values({ ...parsed.data, propertyId, active: true }).returning();
  res.status(201).json(row);
});

router.patch("/:id", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = locationUpdate.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const propertyId = req.authUser!.propertyId!;
  if (parsed.data.name) {
    const [duplicate] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(and(eq(namedLocationsTable.propertyId, propertyId), eq(namedLocationsTable.name, parsed.data.name), ne(namedLocationsTable.id, id.data))).limit(1);
    if (duplicate) return void res.status(409).json({ error: "A location with this name already exists" });
  }
  const [row] = await db.update(namedLocationsTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(namedLocationsTable.id, id.data), eq(namedLocationsTable.propertyId, propertyId))).returning();
  if (!row) return void res.status(404).json({ error: "Location not found" });
  res.json(row);
});

export default router;
