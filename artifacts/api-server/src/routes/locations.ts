import { Router } from "express";
import { db, namedLocationsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /locations
router.get("/", requireAuth, async (req, res) => {
  const locs = await db.select().from(namedLocationsTable)
    .orderBy(asc(namedLocationsTable.name));
  res.json(locs);
});

// POST /locations
router.post("/", requireAuth, async (req, res) => {
  const { name, description, latitude, longitude } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const propertyId = req.session.propertyId;
  const [loc] = await db.insert(namedLocationsTable).values({
    name,
    description,
    latitude,
    longitude,
    propertyId,
    active: true,
  }).returning();

  res.status(201).json(loc);
});

// PATCH /locations/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, latitude, longitude, active } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (latitude !== undefined) updates.latitude = latitude;
  if (longitude !== undefined) updates.longitude = longitude;
  if (active !== undefined) updates.active = active;

  const [loc] = await db.update(namedLocationsTable).set(updates).where(eq(namedLocationsTable.id, id)).returning();
  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(loc);
});

export default router;
