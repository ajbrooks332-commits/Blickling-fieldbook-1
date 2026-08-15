import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { auditEventsTable, db, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { idSchema, isPostgresError, shortText, strongPassword, validationError } from "../lib/validation";

const router = Router();
const roleSchema = z.enum(["administrator", "manager", "team_member"]);
const createSchema = z.object({
  name: shortText,
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: roleSchema,
  password: strongPassword,
}).strict();
const updateSchema = z.object({
  name: shortText.optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: strongPassword.optional(),
}).strict();

const publicColumns = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role,
  active: usersTable.active, propertyId: usersTable.propertyId, createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt, lastLoginAt: usersTable.lastLoginAt,
};

router.get("/users/assignees", requireAuth, async (req, res) => {
  const rows = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(and(eq(usersTable.propertyId, req.authUser!.propertyId!), eq(usersTable.active, true)))
    .orderBy(asc(usersTable.name));
  res.json(rows);
});

router.get("/users", requireAuth, requireRole("administrator"), async (req, res) => {
  const rows = await db.select(publicColumns).from(usersTable)
    .where(eq(usersTable.propertyId, req.authUser!.propertyId!)).orderBy(asc(usersTable.name));
  res.json(rows);
});

router.post("/users", requireAuth, requireRole("administrator"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const [duplicate] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  if (duplicate) return void res.status(409).json({ error: "A user with this email already exists" });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const row = await db.insert(usersTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    passwordHash,
    propertyId: req.authUser!.propertyId!,
    active: true,
    mustChangePassword: true,
  }).returning(publicColumns).then(([created]) => created).catch((error: unknown) => {
    if (isPostgresError(error, "23505")) return null;
    throw error;
  });
  if (!row) return void res.status(409).json({ error: "A user with this email already exists" });
  await db.insert(auditEventsTable).values({ propertyId: req.authUser!.propertyId!, userId: req.authUser!.id,
    eventType: "user_created", newValue: `${parsed.data.name} (${parsed.data.role})` }).catch(() => undefined);
  res.status(201).json(row);
});

router.get("/users/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return validationError(res, id.error);
  const [row] = await db.select(publicColumns).from(usersTable)
    .where(and(eq(usersTable.id, id.data), eq(usersTable.propertyId, req.authUser!.propertyId!))).limit(1);
  if (!row) return void res.status(404).json({ error: "User not found" });
  res.json(row);
});

router.patch("/users/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!id.success || !parsed.success) return validationError(res, !id.success ? id.error : parsed.error);
  const propertyId = req.authUser!.propertyId!;
  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4242, ${propertyId})`);
    const [existing] = await tx.select().from(usersTable)
      .where(and(eq(usersTable.id, id.data), eq(usersTable.propertyId, propertyId))).limit(1);
    if (!existing) return { kind: "not_found" as const };

    const removesAdmin = existing.role === "administrator" &&
      (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "administrator"));
    if (removesAdmin) {
      const [admins] = await tx.select({ value: count() }).from(usersTable)
        .where(and(eq(usersTable.propertyId, propertyId), eq(usersTable.role, "administrator"),
          eq(usersTable.active, true), ne(usersTable.id, id.data)));
      if (admins.value === 0) return { kind: "last_admin" as const };
    }
    if (parsed.data.email) {
      const [duplicate] = await tx.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.email, parsed.data.email), ne(usersTable.id, id.data))).limit(1);
      if (duplicate) return { kind: "duplicate" as const };
    }

    const updates: Partial<typeof usersTable.$inferInsert> = { ...parsed.data, updatedAt: new Date() };
    delete (updates as { password?: string }).password;
    if (passwordHash) {
      updates.passwordHash = passwordHash;
      updates.mustChangePassword = true;
    }
    const revokeSessions = parsed.data.password !== undefined || parsed.data.email !== undefined ||
      parsed.data.role !== undefined || parsed.data.active !== undefined;
    if (revokeSessions) updates.sessionVersion = sql`${usersTable.sessionVersion} + 1` as unknown as number;
    const [row] = await tx.update(usersTable).set(updates).where(eq(usersTable.id, id.data)).returning(publicColumns);
    if (revokeSessions) await tx.execute(sql`DELETE FROM session WHERE sess->>'userId' = ${String(id.data)}`);
    return { kind: "updated" as const, row };
  }).catch((error: unknown) => {
    if (isPostgresError(error, "23505")) return { kind: "duplicate" as const };
    throw error;
  });
  if (result.kind === "not_found") return void res.status(404).json({ error: "User not found" });
  if (result.kind === "last_admin") return void res.status(409).json({ error: "The final active administrator cannot be disabled or demoted" });
  if (result.kind === "duplicate") return void res.status(409).json({ error: "A user with this email already exists" });
  const { row } = result;
  // Audit which fields changed (names only — never values for credentials).
  const changedFields = Object.keys(parsed.data);
  await db.insert(auditEventsTable).values({ propertyId, userId: req.authUser!.id,
    eventType: "user_updated", fieldName: changedFields.join(","),
    metadata: { targetUserId: id.data, sessionsRevoked: changedFields.some((f) => ["password", "email", "role", "active"].includes(f)) },
  }).catch(() => undefined);
  res.json(row);
});

export default router;
