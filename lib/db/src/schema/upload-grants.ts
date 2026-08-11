import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const uploadGrantsTable = pgTable("upload_grants", {
  objectPath: text("object_path").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  originalFilename: text("original_filename").notNull(),
  expectedMimeType: text("expected_mime_type").notNull(),
  expectedSize: integer("expected_size").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UploadGrant = typeof uploadGrantsTable.$inferSelect;
