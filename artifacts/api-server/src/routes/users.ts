import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// GET /users
router.get("/users", requireAuth, async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    active: usersTable.active,
    propertyId: usersTable.propertyId,
    createdAt: usersTable.createdAt,
    lastLoginAt: usersTable.lastLoginAt,
  }).from(usersTable).orderBy(usersTable.name);

  res.json(users);
});

// POST /users
router.post("/users", requireAuth, requireRole("administrator"), async (req, res) => {
  const { name, email, role, password, propertyId } = req.body;
  if (!name || !email || !role || !password) {
    res.status(400).json({ error: "name, email, role, and password are required" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pid = propertyId ?? req.session.propertyId;

  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    role,
    passwordHash,
    propertyId: pid,
    active: true,
  }).returning();

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    propertyId: user.propertyId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

// GET /users/:id
router.get("/users/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    propertyId: user.propertyId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

// PATCH /users/:id
router.patch("/users/:id", requireAuth, requireRole("administrator"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, active, password } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active;
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    propertyId: user.propertyId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

export default router;
