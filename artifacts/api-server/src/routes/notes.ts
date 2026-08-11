import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { actionsTable, auditEventsTable, db, notesTable, observationsTable, usersTable } from "@workspace/db";
import { canUpdateAction, requireAuth } from "../lib/auth";
import { isPostgresError, validationError } from "../lib/validation";

const router = Router();
const noteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  observationId: z.number().int().positive().optional(),
  actionId: z.number().int().positive().optional(),
  offlineId: z.string().uuid().optional(),
}).strict().refine((value) => Number(Boolean(value.observationId)) + Number(Boolean(value.actionId)) === 1, {
  message: "Exactly one of observationId or actionId is required",
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = req.authUser!;

  if (parsed.data.observationId) {
    const [observation] = await db.select({ id: observationsTable.id }).from(observationsTable).where(and(
      eq(observationsTable.id, parsed.data.observationId), eq(observationsTable.propertyId, user.propertyId!), isNull(observationsTable.deletedAt),
    )).limit(1);
    if (!observation) return void res.status(404).json({ error: "Observation not found" });
  }
  if (parsed.data.actionId) {
    const [action] = await db.select().from(actionsTable).where(and(
      eq(actionsTable.id, parsed.data.actionId), eq(actionsTable.propertyId, user.propertyId!), isNull(actionsTable.deletedAt),
    )).limit(1);
    if (!action) return void res.status(404).json({ error: "Action not found" });
    if (!canUpdateAction(user, action.assignedToUserId)) return void res.status(403).json({ error: "Only the assignee or a manager may add action notes" });
  }

  if (parsed.data.offlineId) {
    const [existing] = await db.select().from(notesTable).where(and(
      eq(notesTable.offlineId, parsed.data.offlineId),
      parsed.data.observationId ? eq(notesTable.observationId, parsed.data.observationId) : eq(notesTable.actionId, parsed.data.actionId!),
    )).limit(1);
    if (existing) {
      res.setHeader("X-Idempotent-Replay", "true");
      return void res.json({ ...existing, createdByName: user.name });
    }
  }

  let idempotentReplay = false;
  const note = await db.transaction(async (tx) => {
    const [created] = await tx.insert(notesTable).values({
      body: parsed.data.body,
      observationId: parsed.data.observationId ?? null,
      actionId: parsed.data.actionId ?? null,
      offlineId: parsed.data.offlineId ?? null,
      createdByUserId: user.id,
    }).returning();
    await tx.insert(auditEventsTable).values({
      propertyId: user.propertyId!, observationId: parsed.data.observationId ?? null,
      actionId: parsed.data.actionId ?? null, userId: user.id, eventType: "note_added",
      newValue: parsed.data.body.slice(0, 200),
    });
    return created;
  }).catch(async (error: unknown) => {
    if (parsed.data.offlineId && isPostgresError(error, "23505")) {
      const [replayed] = await db.select().from(notesTable).where(and(
        eq(notesTable.offlineId, parsed.data.offlineId),
        parsed.data.observationId ? eq(notesTable.observationId, parsed.data.observationId) : eq(notesTable.actionId, parsed.data.actionId!),
      )).limit(1);
      if (replayed) { idempotentReplay = true; return replayed; }
    }
    throw error;
  });
  if (idempotentReplay) res.setHeader("X-Idempotent-Replay", "true");
  res.status(idempotentReplay ? 200 : 201).json({ ...note, createdByName: user.name });
});

export default router;
