import { Router } from "express";
import { db, notesTable, usersTable, auditEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// POST /notes
router.post("/notes", requireAuth, async (req, res) => {
  const { body, observationId, actionId } = req.body;
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  if (!observationId && !actionId) {
    res.status(400).json({ error: "observationId or actionId is required" });
    return;
  }

  const [note] = await db.insert(notesTable).values({
    body,
    observationId: observationId ?? null,
    actionId: actionId ?? null,
    createdByUserId: req.session.userId!,
  }).returning();

  // Audit
  await db.insert(auditEventsTable).values({
    propertyId: req.session.propertyId,
    observationId: observationId ?? null,
    actionId: actionId ?? null,
    userId: req.session.userId!,
    eventType: "note_added",
    newValue: body.slice(0, 200),
  });

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, note.createdByUserId!)).limit(1);

  res.status(201).json({
    ...note,
    createdByName: user?.name ?? null,
  });
});

export default router;
