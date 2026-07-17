import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// GET /categories
router.get("/categories", requireAuth, async (req, res) => {
  const cats = await db.select().from(categoriesTable)
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(cats);
});

// POST /categories
router.post("/categories", requireAuth, requireRole("administrator"), async (req, res) => {
  const { name, description, icon, displayColour, sortOrder } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const propertyId = req.session.propertyId;
  const [cat] = await db.insert(categoriesTable).values({
    name,
    description,
    icon,
    displayColour,
    sortOrder: sortOrder ?? 0,
    propertyId,
    active: true,
  }).returning();

  res.status(201).json(cat);
});

// PATCH /categories/:id
router.patch("/categories/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, icon, displayColour, sortOrder, active } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  if (displayColour !== undefined) updates.displayColour = displayColour;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (active !== undefined) updates.active = active;

  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(cat);
});

export default router;
