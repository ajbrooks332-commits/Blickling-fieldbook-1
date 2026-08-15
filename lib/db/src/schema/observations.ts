import { pgTable, serial, text, boolean, integer, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";
import { namedLocationsTable } from "./named-locations";

export const observationPriorityEnum = pgEnum("observation_priority", ["low", "normal", "high", "urgent"]);
export const observationStatusEnum = pgEnum("observation_status", [
  "draft", "submitted", "under_review", "action_required", "monitoring", "resolved", "closed", "cancelled"
]);

export const observationsTable = pgTable("observations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  referenceNumber: text("reference_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  priority: observationPriorityEnum("priority").notNull().default("normal"),
  status: observationStatusEnum("status").notNull().default("submitted"),
  observedAt: timestamp("observed_at").notNull(),
  reportedByUserId: integer("reported_by_user_id").references(() => usersTable.id),
  latitude: real("latitude"),
  longitude: real("longitude"),
  gpsAccuracyMetres: real("gps_accuracy_metres"),
  namedLocationId: integer("named_location_id").references(() => namedLocationsTable.id),
  safetyIssue: boolean("safety_issue").notNull().default(false),
  publicAccessAffected: boolean("public_access_affected").notNull().default(false),
  machineryRequired: boolean("machinery_required").notNull().default(false),
  specialistRequired: boolean("specialist_required").notNull().default(false),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  createdOffline: boolean("created_offline").notNull().default(false),
  offlineId: text("offline_id"),
  syncedAt: timestamp("synced_at"),
  // When the device originally captured the record (may predate created_at).
  deviceCreatedAt: timestamp("device_created_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertObservationSchema = createInsertSchema(observationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observationsTable.$inferSelect;
