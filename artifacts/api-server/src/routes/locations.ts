import { Router } from "express";
import { and, asc, eq, ne, sql } from "drizzle-orm";
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

// Any signed-in user may add a location (quick-add from the activity tracker).
// A same-name (case-insensitive) location is reused — and reactivated if needed.
router.post("/", requireAuth, async (req, res) => {
  const parsed = locationCreate.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const name = parsed.data.name.trim();
  if (!name) return void res.status(400).json({ error: "Location name is required" });
  const findExisting = async () => {
    const [row] = await db.select().from(namedLocationsTable)
      .where(and(eq(namedLocationsTable.propertyId, propertyId), sql`lower(${namedLocationsTable.name}) = lower(${name})`)).limit(1);
    return row;
  };
  let existing = await findExisting();
  if (!existing) {
    // Case-insensitive uniqueness is enforced by a DB index; ON CONFLICT DO NOTHING
    // makes concurrent same-name requests safe — the loser falls through to reuse.
    const [inserted] = await db.insert(namedLocationsTable)
      .values({ ...parsed.data, name, propertyId, active: true })
      .onConflictDoNothing().returning();
    if (inserted) return void res.status(201).json(inserted);
    existing = await findExisting();
    if (!existing) return void res.status(500).json({ error: "Could not create location" });
  }
  if (!existing.active) {
    const [reactivated] = await db.update(namedLocationsTable).set({ active: true, updatedAt: new Date() })
      .where(eq(namedLocationsTable.id, existing.id)).returning();
    return void res.status(200).json(reactivated);
  }
  res.status(200).json(existing);
});

router.patch("/:id", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = locationUpdate.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const name = parsed.data.name?.trim();
  if (name) {
    // Case-insensitive to match the DB unique index on (property_id, lower(name)).
    const [duplicate] = await db.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(and(eq(namedLocationsTable.propertyId, propertyId), sql`lower(${namedLocationsTable.name}) = lower(${name})`, ne(namedLocationsTable.id, id.data))).limit(1);
    if (duplicate) return void res.status(409).json({ error: "A location with this name already exists" });
  }
  try {
    const [row] = await db.update(namedLocationsTable).set({ ...parsed.data, ...(name ? { name } : {}), updatedAt: new Date() })
      .where(and(eq(namedLocationsTable.id, id.data), eq(namedLocationsTable.propertyId, propertyId))).returning();
    if (!row) return void res.status(404).json({ error: "Location not found" });
    res.json(row);
  } catch (error: unknown) {
    // Unique-index race: another request created/renamed to this name between check and update.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      return void res.status(409).json({ error: "A location with this name already exists" });
    }
    throw error;
  }
});

export default router;
