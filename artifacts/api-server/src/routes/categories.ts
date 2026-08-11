import { Router } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { categoriesTable, db } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { colourSchema, idSchema, optionalText, shortText, validationError } from "../lib/validation";

const router = Router();
const categoryCreate = z.object({
  name: shortText,
  description: optionalText(1000),
  icon: z.string().trim().max(80).optional().nullable(),
  displayColour: colourSchema.optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();
const categoryUpdate = categoryCreate.partial().extend({ active: z.boolean().optional() }).strict();

router.get("/categories", requireAuth, async (req, res) => {
  const rows = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.propertyId, req.authUser!.propertyId!))
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(rows);
});

router.post("/categories", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const parsed = categoryCreate.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const [duplicate] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.propertyId, propertyId), eq(categoriesTable.name, parsed.data.name))).limit(1);
  if (duplicate) return void res.status(409).json({ error: "A category with this name already exists" });
  const [row] = await db.insert(categoriesTable).values({ ...parsed.data, propertyId, active: true }).returning();
  res.status(201).json(row);
});

router.patch("/categories/:id", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = categoryUpdate.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const propertyId = req.authUser!.propertyId!;
  if (parsed.data.name) {
    const [duplicate] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(and(eq(categoriesTable.propertyId, propertyId), eq(categoriesTable.name, parsed.data.name), ne(categoriesTable.id, id.data))).limit(1);
    if (duplicate) return void res.status(409).json({ error: "A category with this name already exists" });
  }
  const [row] = await db.update(categoriesTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(categoriesTable.id, id.data), eq(categoriesTable.propertyId, propertyId))).returning();
  if (!row) return void res.status(404).json({ error: "Category not found" });
  res.json(row);
});

export default router;
