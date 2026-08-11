/**
 * Destructive development-only reference-data seed.
 *
 * This deliberately creates no accounts or operational records. Start the app
 * afterwards and complete the secret-protected setup screen to create an admin.
 */
import { sql } from "drizzle-orm";
import {
  actionImagesTable, actionsTable, appSettingsTable, auditEventsTable, categoriesTable, db, namedLocationsTable,
  notesTable, observationImagesTable, observationsTable, pool, propertiesTable, referenceCountersTable,
  uploadGrantsTable, usersTable,
} from "@workspace/db";
import { defaultCategories, defaultLocations } from "./lib/referenceData";

async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("The destructive seed is disabled in production.");
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Set ALLOW_DESTRUCTIVE_SEED=true to confirm replacement of local development data.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(observationImagesTable);
    await tx.delete(actionImagesTable);
    await tx.delete(auditEventsTable);
    await tx.delete(notesTable);
    await tx.delete(actionsTable);
    await tx.delete(observationsTable);
    await tx.delete(uploadGrantsTable);
    await tx.delete(referenceCountersTable);
    await tx.delete(namedLocationsTable);
    await tx.delete(categoriesTable);
    await tx.delete(usersTable);
    await tx.delete(propertiesTable);
    await tx.delete(appSettingsTable);
    await tx.execute(sql`DELETE FROM session`);

    const [property] = await tx.insert(propertiesTable).values({
      name: "Blickling Estate",
      description: "Estate fieldwork, maintenance and observation records.",
      defaultLatitude: 52.8117,
      defaultLongitude: 1.2317,
      defaultZoom: 14,
    }).returning({ id: propertiesTable.id });

    await tx.insert(categoriesTable).values(defaultCategories.map((item, sortOrder) => ({
      propertyId: property.id, ...item, sortOrder, active: true,
    })));
    await tx.insert(namedLocationsTable).values(defaultLocations.map((item) => ({
      propertyId: property.id, ...item, active: true,
    })));
    await tx.insert(appSettingsTable).values({ id: 1 });
  });

  console.info(`Development reference data created (${defaultCategories.length} categories, ${defaultLocations.length} locations).`);
  console.info("Start the app and use SETUP_SECRET on the setup screen to create the administrator.");
}

seed().catch((error) => {
  console.error("Development seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => pool.end());
