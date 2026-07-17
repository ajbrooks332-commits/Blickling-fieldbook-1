/**
 * ONE-TIME production reset route. Remove this file and its registration
 * in routes/index.ts immediately after use.
 */
import { Router } from "express";
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
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

const RESET_TOKEN = "BlicklingReset2026-NTField";

router.post("/admin/one-time-reset", async (req, res) => {
  const token = req.headers["x-reset-token"];
  if (token !== RESET_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    // Wipe content tables in FK-safe order
    await db.delete(auditEventsTable);
    await db.delete(actionImagesTable);
    await db.delete(observationImagesTable);
    await db.delete(notesTable);
    await db.delete(actionsTable);
    await db.delete(observationsTable);
    await db.execute(sql`DELETE FROM session`);
    await db.delete(usersTable);

    // Create the single admin user
    const passwordHash = await bcrypt.hash("BlicklingNT26", 12);
    const [user] = await db.insert(usersTable).values({
      name: "Countryside Manager",
      email: "andrew.brooks@nationaltrust.org.uk",
      passwordHash,
      role: "administrator",
      active: true,
    }).returning({ id: usersTable.id, email: usersTable.email });

    return res.json({ ok: true, adminUser: user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
