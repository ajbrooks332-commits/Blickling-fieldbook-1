import { timingSafeEqual } from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, appSettingsTable, categoriesTable, namedLocationsTable, propertiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../lib/auth";
import { strongPassword, validationError } from "../lib/validation";
import { defaultCategories, defaultLocations } from "../lib/referenceData";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

const setupSchema = z.object({
  setupSecret: z.string().min(24).max(256),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(14).max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    propertyId: user.propertyId,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
  };
}

async function setupComplete(): Promise<boolean> {
  const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1)).limit(1);
  return Boolean(settings?.setupCompletedAt);
}

router.get("/setup-status", async (_req, res) => {
  res.json({ required: !(await setupComplete()) });
});

router.post("/setup", loginLimiter, async (req, res) => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid setup details", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const configuredSecret = process.env.SETUP_SECRET;
  if (!configuredSecret || configuredSecret.length < 24) {
    res.status(503).json({ error: "SETUP_SECRET must be configured in Replit Secrets" });
    return;
  }
  if (!safeEqual(parsed.data.setupSecret, configuredSecret)) {
    res.status(403).json({ error: "Invalid setup secret" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT setup_completed_at FROM app_settings WHERE id = 1 FOR UPDATE`);
    if (locked.rows[0]?.setup_completed_at) throw new Error("SETUP_COMPLETE");

    let [property] = await tx.select().from(propertiesTable).limit(1);
    if (!property) {
      [property] = await tx.insert(propertiesTable).values({
        name: "Blickling Estate",
        description: "Blickling Estate countryside fieldbook",
      }).returning();
    }

    const [category] = await tx.select({ id: categoriesTable.id }).from(categoriesTable)
      .where(eq(categoriesTable.propertyId, property.id)).limit(1);
    if (!category) {
      await tx.insert(categoriesTable).values(defaultCategories.map((item, sortOrder) => ({
        propertyId: property.id,
        ...item,
        sortOrder,
        active: true,
      })));
    }

    const [location] = await tx.select({ id: namedLocationsTable.id }).from(namedLocationsTable)
      .where(eq(namedLocationsTable.propertyId, property.id)).limit(1);
    if (!location) {
      await tx.insert(namedLocationsTable).values(defaultLocations.map((item) => ({
        propertyId: property.id,
        ...item,
        active: true,
      })));
    }

    await tx.execute(sql`DELETE FROM session`);
    await tx.update(usersTable).set({ active: false, sessionVersion: sql`${usersTable.sessionVersion} + 1` });

    const [existing] = await tx.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
    const [admin] = existing
      ? await tx.update(usersTable).set({
          name: parsed.data.name,
          passwordHash,
          role: "administrator",
          active: true,
          propertyId: property.id,
          sessionVersion: existing.sessionVersion + 1,
          mustChangePassword: false,
          updatedAt: new Date(),
        }).where(eq(usersTable.id, existing.id)).returning()
      : await tx.insert(usersTable).values({
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: "administrator",
          active: true,
          propertyId: property.id,
          mustChangePassword: false,
        }).returning();

    await tx.update(appSettingsTable).set({ setupCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(appSettingsTable.id, 1));
    return admin;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "SETUP_COMPLETE") return null;
    throw error;
  });

  if (!user) {
    res.status(409).json({ error: "Initial setup has already been completed" });
    return;
  }

  req.session.regenerate((error) => {
    if (error) {
      res.status(500).json({ error: "Setup completed but login failed; sign in normally" });
      return;
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.propertyId = user.propertyId;
    req.session.sessionVersion = user.sessionVersion;
    res.status(201).json(publicUser(user));
  });
});

router.post("/login", loginLimiter, async (req, res) => {
  if (!(await setupComplete())) {
    res.status(503).json({ error: "Initial setup is required", code: "SETUP_REQUIRED" });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid || !user.active || !user.propertyId) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  req.session.regenerate((error) => {
    if (error) {
      res.status(500).json({ error: "Unable to create a secure session" });
      return;
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.propertyId = user.propertyId;
    req.session.sessionVersion = user.sessionVersion;
    res.json(publicUser(user));
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    res.clearCookie("blickling.sid", { path: "/" });
    if (error) {
      res.status(500).json({ error: "Unable to log out cleanly" });
      return;
    }
    res.json({ ok: true });
  });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1).max(128), newPassword: strongPassword }).strict().safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  const user = req.authUser!;
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const [updated] = await db.update(usersTable).set({
    passwordHash,
    mustChangePassword: false,
    sessionVersion: user.sessionVersion + 1,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id)).returning();
  await db.execute(sql`DELETE FROM session WHERE sess->>'userId' = ${String(user.id)}`);
  req.session.regenerate((error) => {
    if (error) return void res.status(500).json({ error: "Password changed, but a new session could not be created. Sign in again." });
    req.session.userId = updated.id;
    req.session.sessionVersion = updated.sessionVersion;
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.authUser!));
});

export default router;
