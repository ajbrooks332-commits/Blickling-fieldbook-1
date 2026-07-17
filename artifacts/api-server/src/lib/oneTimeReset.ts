/**
 * One-time production reset.
 * Detects old seed data (admin@blickling.nt) and replaces it with the real
 * admin account. Runs at startup, is self-eliminating (condition is never true
 * again after first run), and logs clearly so it is visible in deployment logs.
 */
import { db } from "@workspace/db";
import {
  usersTable,
  observationsTable,
  actionsTable,
  notesTable,
  auditEventsTable,
  observationImagesTable,
  actionImagesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function runOneTimeResetIfNeeded() {
  try {
    const oldAdmin = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "admin@blickling.nt"))
      .limit(1);

    if (oldAdmin.length === 0) {
      // Already clean — nothing to do
      return;
    }

    logger.info("One-time reset: detected seed data, clearing and creating real admin account...");

    // Wipe content in FK-safe order
    await db.delete(auditEventsTable);
    await db.delete(actionImagesTable);
    await db.delete(observationImagesTable);
    await db.delete(notesTable);
    await db.delete(actionsTable);
    await db.delete(observationsTable);
    await db.execute(sql`DELETE FROM session`);
    await db.delete(usersTable);

    // Create the real admin account
    const passwordHash = await bcrypt.hash("BlicklingNT26", 12);
    const [user] = await db.insert(usersTable).values({
      name: "Countryside Manager",
      email: "andrew.brooks@nationaltrust.org.uk",
      passwordHash,
      role: "administrator",
      active: true,
    }).returning({ id: usersTable.id, email: usersTable.email });

    logger.info({ user }, "One-time reset: complete. Admin account created.");
  } catch (err) {
    logger.error({ err }, "One-time reset: failed — check logs and retry");
  }
}
